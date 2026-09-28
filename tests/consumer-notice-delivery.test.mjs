import test from 'node:test';
import assert from 'node:assert/strict';
import { sendNoticeToAgent } from '../lib/consumer-notice-delivery.ts';

const config = { ZOHO_CLIENT_ID: 'test', ZOHO_CLIENT_SECRET: 'test', ZOHO_REFRESH_TOKEN: 'test', ZOHO_ACCOUNT_ID: '123', ZOHO_FROM_ADDRESS: 'ben@housingpa.com' };
const notice = { name: 'Test Seller', email: 'seller@example.com', address: 'Test address', pdfBytes: new Uint8Array([37,80,68,70]) };
const upload = { status:{code:200},data:{storeName:'test',attachmentName:'notice.pdf',attachmentPath:'/test/notice.pdf'} };

test('emails the signed PDF only to the agent with manual countersign instructions', async () => {
  const calls = [];
  const responses = [{access_token:'test'},upload,{status:{code:200},data:{messageId:'message-123'}}];
  const result = await sendNoticeToAgent(notice, config, async (url, options) => {
    calls.push({url,options});
    return Response.json(responses.shift());
  });
  assert.equal(result.recipient,'ben@housingpa.com');
  assert.deepEqual(new Uint8Array(calls[1].options.body),notice.pdfBytes);
  const sent = JSON.parse(calls[2].options.body);
  assert.equal(sent.toAddress,'ben@housingpa.com');
  assert.equal(sent.ccAddress,undefined);
  assert.equal(sent.bccAddress,undefined);
  assert.match(sent.content,/countersign manually/);
  assert.match(sent.content,/seller@example.com/);
  assert.equal(sent.attachments[0].attachmentPath,'/test/notice.pdf');
});

test('authentication failure never uploads or sends and does not expose response secrets', async () => {
  let calls=0;
  await assert.rejects(sendNoticeToAgent(notice,config,async()=>{
    calls++;
    return Response.json({error:'invalid_client',secret:'never-show'}, {status:401});
  }), error=> !error.message.includes('never-show') && error.message.includes('HTTP 401'));
  assert.equal(calls,1);
});

test('a failed attachment upload cannot produce a send', async()=>{
  let calls=0;
  await assert.rejects(sendNoticeToAgent(notice,config,async()=>Response.json(++calls===1?{access_token:'test'}:{status:{code:200},data:{}})),/attachment upload failed/);
  assert.equal(calls,2);
});

test('unconfirmed send is not reported as success and is not automatically retried', async()=>{
  let calls=0;
  const responses=[{access_token:'test'},upload,{status:{code:200},data:{}}];
  await assert.rejects(sendNoticeToAgent(notice,config,async()=>{calls++;return Response.json(responses.shift())}),/could not be confirmed/);
  assert.equal(calls,3);
});

test('missing mail configuration fails before any request',async()=>{
  await assert.rejects(sendNoticeToAgent(notice,{},async()=>{throw Error('should not request')}),/unavailable/);
});
