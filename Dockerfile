FROM node:12.16.2

ENV DEBIAN_FRONTEND noninteractive
ENV DEBIAN_PRIORITY critical
ENV DEBCONF_NOWARNINGS yes
ENV PANDOC_VERSION 2.9.2.1
ENV NODE_ENV production

RUN apt-get -qq update && \
    apt-get -qq -y install wget texlive-latex-base texlive-fonts-recommended && \
    apt-get -qq -y install texlive-fonts-extra texlive-latex-extra texlive-full && \
    apt-get clean

RUN wget https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-amd64.deb && \
    dpkg -i pandoc* && \
    rm pandoc* && \
    apt-get clean

RUN apt-get -qq -y install build-essential checkinstall && \
    apt-get -qq -y install libreadline-gplv2-dev libncursesw5-dev libssl-dev libsqlite3-dev tk-dev libgdbm-dev libc6-dev libbz2-dev libffi-dev zlib1g-dev && \
    cd /opt && \
    wget https://www.python.org/ftp/python/3.8.2/Python-3.8.2.tgz && \
    tar xzf Python-3.8.2.tgz && \
    cd Python-3.8.2 && \
    ./configure --enable-optimizations && \
    make install && \
    cd /opt && \
    rm -f Python-3.8.2.tgz && \
    apt-get -qq -y install python3-pip python-pip && \
    pip install pandocfilters && \
    pip3 install pandocfilters && \
    apt-get clean

RUN mkdir /app && \
    mkdir /app/assets && \
    mkdir /app/output

WORKDIR /app

COPY ./ /app

RUN npm install

EXPOSE 80

CMD ["node", "server.js"]
