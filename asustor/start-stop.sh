#!/bin/sh

PIDFILE=/var/run/eynio.pid

start_package()
{
    HOME=/usr/local/etc /usr/local/bin/node ${APKG_PKG_DIR}/server.js --nocolor --pidfile $PIDFILE --platform Asustor &> ${APKG_PKG_DIR}/server.log &
}

stop_package()
{
    if [ -f $PIDFILE ]; then
        /bin/kill $(cat $PIDFILE)
        rm $PIDFILE
    fi
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
