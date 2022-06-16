#/bin/bash

set -e

rm -rf node_modules/.cache
mkdir -p node_modules/@logion/node-api

function install_custom {
    PACKAGE_NAME=$1
    if [ -f ../logion-api/packages/$PACKAGE_NAME/package.tgz ]
    then
        cp ../logion-api/packages/$PACKAGE_NAME/package.tgz node_modules/@logion/
        (
            cd node_modules/@logion/
            rm -rf $PACKAGE_NAME
            tar xzvf package.tgz
            mv package $PACKAGE_NAME
            rm package.tgz
        )
    fi
}


install_custom node-api
