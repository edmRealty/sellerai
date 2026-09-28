type Notice = { name: string; email: string; address: string; pdfBytes: Uint8Array };
type Config = Record<string, string | undefined>;

export const NOTICE_AGENT_SENT = "Your Consumer Notice is signed and sent to the agent. You'll receive a copy after the agent signs.";
export const NOTICE_AGENT_FAILED = "Your Consumer Notice is signed, but we couldn't send it to the agent. Please download your signed copy and contact ben@housingpa.com. You'll receive the completed copy after the agent signs.";

export async function sendNoticeToAgent(notice: Notice, config: Config = process.env, request: typeof fetch = fetch) {
  const required = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ACCOUNT_ID'];
  if (required.some(key => !config[key])) throw new Error('Consumer Notice mail connection is unavailable');
  const recipient = config.CONSUMER_NOTICE_AGENT_EMAIL || 'ben@housingpa.com';
  const sender = config.ZOHO_FROM_ADDRESS || 'ben@housingpa.com';
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)) throw new Error('Invalid agent mailbox configuration');
  const jsonRequest = async (url: string, options: RequestInit) => {
    const response = await request(url, { ...options, signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || result.error || (result.status && Number(result.status.code) !== 200)) {
      // Never include OAuth responses, credentials, or provider payloads in errors.
      throw new Error(`Consumer Notice mail service failed (HTTP ${response.status})`);
    }
    return result;
  };
  const auth = await jsonRequest('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.ZOHO_CLIENT_ID!,
      client_secret: config.ZOHO_CLIENT_SECRET!,
      refresh_token: config.ZOHO_REFRESH_TOKEN!
    })
  });
  if (!auth.access_token) throw new Error('Consumer Notice mail authentication failed');
  const headers = { Authorization: `Zoho-oauthtoken ${auth.access_token}` };
  const base = `https://mail.zoho.com/api/accounts/${encodeURIComponent(config.ZOHO_ACCOUNT_ID!)}/messages`;
  const uploaded = await jsonRequest(`${base}/attachments?fileName=Seller-Signed-Consumer-Notice.pdf&isInline=false`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/pdf' }, body: Buffer.from(notice.pdfBytes)
  });
  const attachment = Array.isArray(uploaded.data) ? uploaded.data[0] : uploaded.data;
  if (!attachment?.storeName || !attachment?.attachmentPath || !attachment?.attachmentName) throw new Error('Consumer Notice attachment upload failed');
  const result = await jsonRequest(base, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAddress: `SellerAI <${sender}>`,
      toAddress: recipient,
      subject: `Agent signature required: Consumer Notice - ${notice.address.replace(/[\r\n]/g, ' ')}`,
      mailFormat: 'plaintext',
      content: `The seller has signed the attached Consumer Notice.\n\nSeller: ${notice.name}\nSeller email: ${notice.email}\nProperty: ${notice.address}\n\nPlease review and countersign manually, then return the completed copy to the seller at the email above. No copy has been emailed to the seller by SellerAI.\n\nQuinn and Wilson Realty\nJenkintown, PA`,
      attachments: [{ storeName: attachment.storeName, attachmentPath: attachment.attachmentPath, attachmentName: attachment.attachmentName }]
    })
  });
  if (!result.data?.messageId) throw new Error('Consumer Notice mail acceptance could not be confirmed');
  return { messageId: String(result.data.messageId), recipient };
}
