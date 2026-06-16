#!/bin/bash
SWAPFILE=/var/swapfile
SWAP_MEGABYTES=2048

if [ -f $SWAPFILE ]; then
    echo "Swapfile $SWAPFILE found, assuming already setup"
    exit;
fi

/bin/dd if=/dev/zero of=$SWAPFILE bs=1M count=$SWAP_MEGABYTES
/sbin/mkswap $SWAPFILE
/sbin/swapon $SWAPFILE
