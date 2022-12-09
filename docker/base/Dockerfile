FROM node:18
RUN apt-get update && apt-get -y --no-install-recommends install postgresql-client libimage-exiftool-perl ; rm -rf /var/lib/apt/lists/*
WORKDIR /usr/share/logion-backend

RUN VERSION=0.14.5 \
    && FILE_NAME=ipfs-cluster-ctl_v${VERSION}_linux-amd64.tar.gz \
    && rm -f ${FILE_NAME} \
    && wget https://dist.ipfs.io/ipfs-cluster-ctl/v${VERSION}/${FILE_NAME} \
    && tar xzvf ${FILE_NAME} \
    && rm ${FILE_NAME}

ENV IPFS_CLUSTER_CTL "/usr/share/logion-backend/ipfs-cluster-ctl/ipfs-cluster-ctl"
