FROM paritytech/ci-linux:production
COPY . /tmp/calc
WORKDIR /tmp/calc
RUN ./build.sh && rm -rf ./target && rm -rf /root/.cache/ && rm -rf /usr/local/cargo/registry
