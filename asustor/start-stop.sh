#!/bin/sh

start_package()
{
    HOME=/usr/local/etc /usr/local/bin/node ${APKG_PKG_DIR}/server.js --nocolor &> ${APKG_PKG_DIR}/server.log &
}

stop_package()
{
    /usr/bin/pkill -f server.js
}

case $1 in
	start)
		start_package
        exit 0
        ;;
    stop)
        stop_package
        exit 0
        ;;
esac
