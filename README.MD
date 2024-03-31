## 添加 hosts

```
cat >> /etc/hosts <<EOF
192.168.200.128 www.abc1.com
192.168.200.129 www.abc2.com
192.168.200.130 www.abc3.com
EOF

```

## 修改软件源

```
sed -e 's|^mirrorlist=|#mirrorlist=|g' \
    -e 's|^#baseurl=http://mirror.centos.org|baseurl=http://mirrors.aliyun.com|g' \
    -i.bak \
    /etc/yum.repos.d/CentOS-Base.repo
```

## 修改终端颜色

```
cat <<EOF >> ~/.bashrc
PS1='[\[\e[34;1m\]\u@\[\e[0m\]\[\e[32;1m\]\H\[\e[0m\]\[\e[33;1m\] \W\[\e[0m\]]# '
EOF
source ~/.bashrc
```

## 修改 sshd 服务优化

```
sed -ri 's@^#UseDNS yes@UseDNS no@g' /etc/ssh/sshd_config
sed -ri 's@^GSSAPIAuthentication yes@GSSAPIAuthentication no@g' /etc/ssh/sshd_config
grep ^UseDNS /etc/ssh/sshd_config
grep ^GSSAPIAuthentication /etc/ssh/sshd_config
```

## 关闭防火墙

```
systemctl disable --now firewalld && systemctl is-enabled firewalld
systemctl status firewalld
```

## 禁用 SELINUX

```
sed -ri 's#(SELINUX=)enforcing#\1disabled#' /etc/selinux/config
grep ^SELINUX= /etc/selinux/config
setenforce 0
getenforce
```

## 配置集群免密登录及同步脚本

```
(1) 修改主机列表
cat >> /etc/hosts <<EOF
192.168.200.128 www.abc1.com
192.168.200.129 www.abc2.com
192.168.200.130 www.abc3.com
EOF

(2) 生成密钥
ssh-keygen -t rsa -P '' -f ~/.ssh/id_rsa -q

(3)01节点配置所有集群节点的免密登录
for ((host_id=1; host_id<=3; host_id++)); do ssh-copy-id www.abc${host_id}.com; done

(4) 测试
ssh www.abc1.com
ssh www.abc2.com
ssh www.abc3.com

(5) 所有节点安装rsync数据同步攻击
yum -y install rsync

(6) 编写同步脚本
vi /usr/local/sbin/data_rsync.sh

#!/bin/bash

if [ $# -ne 1 ]; then
  echo "Usage: $0 /path/to/file(绝对路径)"
  exit 1
fi

if [ ! -e $1 ]; then
  echo "[ $1 ] dir or file not found"
  exit 1
fi

fullpath=`dirname $1`
basename=`basename $1`

cd $fullpath

for ((i=1; i<=3; i++))
  do
    tput setaf 2
    echo ==== rsyncing $basename to www.abc${i}.com  ====
    tput setaf 7
    rsync -az $basename `whoami`@www.abc${i}.com:$fullpath
    if [ $? -eq 0 ];then
            echo 'rsync success'
    fi
  done
```

## 集群时间同步

```
(1)
yum -y install vim net-tools
(2)
yum -y install ntpdate chrony
(3)
vim /etc/chrony.conf

## 先注释，后粘贴
server ntp.aliyun.com iburst
server ntp1.aliyun.com iburst
server ntp2.aliyun.com iburst
server ntp3.aliyun.com iburst
server ntp4.aliyun.com iburst
server ntp5.aliyun.com iburst

(4)
systemctl enable --now chronyd

(5)
systemctl status chronyd
```

# 单节点部署实战

## 下载地址

https://www.elastic.co/downloads/past-releases/elasticsearch-7-17-3

## 部署 JDK 环境-可选步骤

TODO

## 单节点部署 elasticsearch

```
(1) 安装服务
yum -y localinstall elasticsearch-7.17.3-x86_64.rpm
(2) 修改配置文件
vi /etc/elasticsearch/elasticsearch.yml

cluster.name: qqq-elk
node.name: qqq01
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch
network.host: 0.0.0.0
#请用 ip，不要主机名
discovery.seed_hosts: ["192.168.200.128"]
(3)
启动服务
systemctl start elasticsearch.service
```

## OpenJDK 切换

TODO

# 部署集群

## 配置文件

```
vi /etc/elasticsearch/elasticsearch.yml

#请用 ip，不要主机名
discovery.seed_hosts: ["192.168.200.128", "192.168.200.129", "192.168.200.130"] #同上，要 ip
cluster.initial_master_nodes: ["192.168.200.128", "192.168.200.129", "192.168.200.130"]
```

## 同步配置

```
(1)
data_rsync.sh /etc/elasticsearch/elasticsearch.yml

(2)
vi /etc/elasticsearch/elasticsearch.yml

node.name: qqq02

(3)
vi /etc/elasticsearch/elasticsearch.yml

node.name: qqq03
```

## 删除临时数据

```
rm -rf /var/{lib,log}/elasticsearch/* /temp/*
```

## 启动节点

```
systemctl start elasticsearch
```

## 验证节点

```
curl 192.168.200.128:9200/_cat/nodes
```

# 部署 kibana 服务

```
(1) 地址
https://www.elastic.co/downloads/past-releases/kibana-7-17-3

(2) 安装
yum -y localinstall kibana-7.17.3-x86_64.rpm

(3) 修改配置
vi /etc/kibana/kibana.yml
server.host: "0.0.0.0"
server.name: "qzh-kibana"
elasticsearch.hosts: ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
i18n.locale: "zh-CN"

(4) 检查
egrep -v "^#|^$" /etc/kibana/kibana.yml

(5)验证
curl 192.168.200.128:9200/_cat/nodes
```

# Filebeat 部署

### 安装

```
(1) 地址
https://www.elastic.co/downloads/past-releases/filebeat-7-17-3

(2) 安装
yum -y localinstall filebeat-7.17.3-x86_64.rpm
```

## 修改 filebeat 的配置文件 (监听 stdin)

```python
(1) 修改配置文件名字
mv /etc/filebeat/filebeat.yml /etc/filebeat/filebeat.yml-`date +%F`

(2) 重新创建
vi /etc/filebeat/filebeat.yml

(3) 编写测试文件
filebeat.inputs:
- type: stdin
output.console:
  pretty: true

(4) 运行filebeat 实例
filebeat -e -c /etc/filebeat/filebeat.yml

(5) 移动配置文件
mkdir /etc/filebeat/config
cp /etc/filebeat/filebeat.yml /etc/filebeat/config/01-stdin-to-console.yml

(6) 运行filebeat 实例
filebeat -e -c /etc/filebeat/config/01-stdin-to-console.yml
```

## 修改 filebeat 的配置文件 (监听指定文件)

```python
(1) 编辑配置文件
vi /etc/filebeat/config/02-log-to-console.yml

filebeat.inputs:
- type: log
  paths:
    - /tmp/test.log
output.console:
  pretty: true

(2) 运行
filebeat -e -c /etc/filebeat/config/02-log-to-console.yml

```

## 通用配置

```python
(1)
vi /etc/filebeat/config/03-field.yml

filebeat.inputs:
- type: log
  enable: true
  paths:
    - /tmp/python/test.log
  tags: ['elk_python']
  fields:
    school: "qing pu primary school"
    class: "elk9999"
- type: log
  enable: true
  paths:
    - /tmp/kafka/test.log
  tags: ['elk_kafka']
output.console:
  pretty: true
```

# 13 filebeat 的 output 类型

## 输出到 elasticsearch

```python
vi /etc/filebeat/config/04-output-elasticsearch.yml

filebeat.inputs:
- type: log
  enable: true
  paths:
    - /tmp/python/test.log
  tags: ['elk_python']
  fields:
    school: "qing pu primary school"
    class: "elk9999"
- type: log
  enable: true
  paths:
    - /tmp/kafka/test.log
  tags: ['elk_kafka']
output.elasticsearch:
  hosts: ["http://192.168.200.128", "http://192.168.200.129", "http://192.168.200.130"]
```

# 14 自定义 ES 的索引名称案例

## 指定索引名称

```python
vi /etc/filebeat/config/05-output-elasticsearch.yml

filebeat.inputs:
- type: log
  enable: true
  paths:
    - /tmp/python/test.log
  tags: ['elk_python']
  fields:
    school: "qing pu primary school"
    class: "elk9999"
- type: log
  enable: true
  paths:
    - /tmp/kafka/test.log
  tags: ['elk_kafka']
output.elasticsearch:

  hosts: ["http://192.168.200.128", "http://192.168.200.129", "http://192.168.200.130"]
```

# 15-根据 tag 字段写入不同的索引案例

### 根据 tag， 把日志写入不同索引

```python
vi /etc/filebeat/config/06-output-elasticsearch.yml

filebeat.inputs:
  - type: log
    paths:
      - /tmp/python/test.log
    tags: ["elk_python"]
    fields:
      school: "qing pu primary school"
      class: "elk9999"
  - type: log
    paths:
      - /tmp/kafka/test.log
    tags: ["elk_kafka"]
output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-python-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_python"
    - index: "qzh-elk-kafka-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_kafka"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"


```

# 16-ES 的分片和副本及 filebeat 配置

```python

vi /etc/filebeat/config/07-output-elasticsearch.yml
filebeat.inputs:
  - type: log
    paths:
      - /tmp/python/test.log
    tags: ["elk_python"]
    fields:
      school: "qing pu primary school"
      class: "elk9999"
  - type: log
    paths:
      - /tmp/kafka/test.log
    tags: ["elk_kafka"]
output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-python-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_python"
    - index: "qzh-elk-kafka-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_kafka"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1

```

# 17 作业

```python
(1) 安装nginx
sudo yum update
sudo yum install epel-release
sudo yum install nginx
sudo systemctl start nginx
sudo systemctl enable nginx

(2) 浏览器访问 192.168.200.129

(3)
vi /etc/filebeat/config/08-nginx-log.yml
filebeat.inputs:
  - type: log
    paths:
      - /tmp/python/test.log
    tags: ["elk_python"]
    fields:
      school: "qing pu primary school"
      class: "elk9999"
  - type: log
    paths:
      - /tmp/kafka/test.log
    tags: ["elk_kafka"]
  - type: log
    paths:
      - /var/log/nginx/*.log
    tags: ["elk_nginx"]
output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-python-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_python"
    - index: "qzh-elk-kafka-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_kafka"
    - index: "qzh-elk-nginx-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_nginx"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1

```

# 02-EFK 架构的 nginx 原生日志收集

```python

vi /etc/filebeat/config/09-nginx-log.yml

filebeat.inputs:
  - type: log
    paths:
      - /var/log/nginx/*.log*
    tags: ["elk_nginx"]
output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-nginx-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_nginx"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1

```

# 03-基于 log 类型收集 nginx 的 json 日志

```python
(1) nginx log 格式
log_format qzh_nginx_json '{"@timestamp":"$time_iso8601",'
        '"host":"$server_addr",'
        '"clientip":"$remote_addr",'
        '"size":$body_bytes_sent,'
        '"responsetime":"$request_time",'
        '"upstreamtime":"$upstream_response_time",'
        '"upstreamhost":"$upstream_addr",'
        '"http_host":"$host",'
        '"url":"$uri",'
        '"domain":"$host",'
        '"xff":"$http_x_forwarded_for",'
        '"referer":"$http_referer",'
        '"tcp_xff":"$http_x_real_ip",'
        '"http_user_agent":"$http_user_agent",'
        '"status":"$status"}';

access_log /var/log/nginx/access.log qzh_nginx_json;

(2)
vi /etc/filebeat/config/10-nginx-log.yml

filebeat.inputs:
  - type: log
    paths:
      - /var/log/nginx/*.log*
    tags: ["elk_nginx"]
    json.keys_under_root: true # 如果json 日志中包含 斜杠 /， 有可能导致json 解析失败
output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-nginx-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_nginx"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1

```

# 04-filebeat 的内置模块收集 nginx 日志

```python
(1)
vi /etc/filebeat/config/11-filebeat-module.yml

filebeat.config.modules:
  path: ${path.config}/modules.d/*.yml ## 适用于 yum 安装的 filebeat
  reload.enabled: false

output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-nginx-%{+yyyy.MM.dd}"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1

(2)
filebeat -c /etc/filebeat/config/11-filebeat-module.yml modules enable nginx tomcat

(3)
vi /etc/filebeat/modules.d/nginx.yml

- module: nginx
  access:
    .........
    var.paths: ["/var/log/nginx/access.log*"]
  error:
    .......
    var.paths: ["/var/log/nginx/error.log*"]
```

# 06 tomcat 案例

## 安装 tomcat

```
(1) 下载tomcat
wget https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.19/bin/apache-tomcat-10.1.19.tar.gz

（2）解压
tar xf apache-tomcat-10.1.19.tar.gz -C /softwares
(3) 安装java 和 tomcat
vi /etc/profile.d/jdk.sh

#!/bin/bash
export TOMCAT_HOME=/softwares/apache-tomcat-10.1.19
export JAVA_HOME=/usr/share/elasticsearch/jdk
export PATH=$TOMCAT_HOME/bin:$JAVA_HOME/bin:$PATH

(4) source /etc/profile.d/jdk.sh
(5) 启动tomcat
catalina.sh start

(6) 查看日志
cat /softwares/apache-tomcat-10.1.19/logs/localhost_access_log.2024-03-13.txt
```

## 配置 filebeat module

```python
(1) 启动filebeat 内置的 tomcat 日志 解析模块, 关闭nginx 模块
filebeat -c /etc/filebeat/config/11-filebeat-module.yml modules enable tomcat

filebeat -c /etc/filebeat/config/12-filebeat-module.yml modules disable nginx

(2)
vi /etc/filebeat/config/12-filebeat-module.yml

filebeat.config.modules:
  path: ${path.config}/modules.d/*.yml
  reload.enabled: false

output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-tomcat-%{+yyyy.MM.dd}"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1

(3) vi /etc/filebeat/modules.d/tomcat.yml
- module: tomcat
  log:
    enabled: true
    var.input: file
    var.paths:
      - /softwares/apache-tomcat-10.1.19/logs/*.txt
(4) 启动 filebeat
filebeat -e -c /etc/filebeat/config/12-filebeat-module.yml
```

# 08 收集 tomcat 原生日志

```python
vi /etc/filebeat/config/13-tomcat.yml

filebeat.inputs:
- type: log
  paths:
    - /softwares/apache-tomcat-10.1.19/logs/*.txt

output.elasticsearch:
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  index: "qzh-elk-tomcat-%{+yyyy.MM.dd}"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 1
```

# 09-filebeat 收集 tomcat json 日志

```python
(1) 修改配置文件（让tomcat 输出json 格式的日志）
cp /softwares/apache-tomcat-10.1.19/conf/{server.xml, server.xml-`date +%F`}
vi /softwares/apache-tomcat-10.1.19/conf/server.xml


<Host name="qzh2.abc.com"  appBase="webapps"
      unpackWARs="true" autoDeploy="true">
          <Valve className="org.apache.catalina.valves.AccessLogValve"
          directory="logs"
                    prefix="tomcat.qzh.com_access_log" suffix=".txt"
          pattern="{&quot;clientip&quot;:&quot;%h&quot;,&quot;ClientUser&quot;:&quot;%l&quot;,&quot;authenticated&quot;:&quot;%u&quot;,&quot;AccessTime&quot;:&quot;%t&quot;,&quot;request&quot;:&quot;%r&quot;,&quot;status&quot;:&quot;%s
          &quot;,&quot;SendBytes&quot;:&quot;%b&quot;,&quot;Query?string&quot;:&quot;%q&quot;,&quot;partner&quot;:&quot;%{Referer}i&quot;,&quot;http_user_agent&quot;:&quot;%{UserAgent}i&quot;}"/>
</Host>


(2) 启动 tomcat
catalina.sh start

(3)
vi /etc/filebeat/config/14-tomcat.yml

filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /softwares/apache-tomcat-10.1.19/logs/*.txt
  json.keys_under_root: true # 如果json 日志中包含 斜杠 /， 有可能导致json 解析失败

output.elasticsearch:
  enabled: true
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  index: "qzh-elk-tomcat-%{+yyyy.MM.dd}"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 0
```

# 11-filebeat 多行匹配案例收集 tomcat

```python
vi /etc/filebeat/config/15-tomcat-error.yml

filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /softwares/apache-tomcat-10.1.19/logs/catalina.out

  multiline.type: pattern
  multiline.pattern: '^[[:space:]]'
  multiline.negate: false
  multiline.match: after
  tags: ['error_stack']

output.elasticsearch:
  enabled: true
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-tomcat-error-%{+yyyy.MM.dd}"
      when.contains:
        tags: "error_stack"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 0
```

# 14 nginx 错误日志过滤

```python
vi /etc/filebeat/config/16-nginx-error-filter.yml

filebeat.inputs:
- type: log
  paths:
    - /var/log/nginx/access.log*
  tags: ["elk_access"]
  json.keys_under_root: true

- type: log
  paths:
    - /var/log/nginx/error.log*
  tags: ["elk_error"]
  include_lines: ['\[error\]']

output.elasticsearch:
  enabled: true
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-nginx-access-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_access"
    - index: "qzh-elk-nginx-error-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_error"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 0

```

# 15 同时收集 nginx tomcat 日志

```python
vi /etc/filebeat/config/17-nginx-tomcat.yml

filebeat.inputs:
- type: log
  paths:
    - /var/log/nginx/access.log*
  tags: ["qzh_nginx_access"]
  json.keys_under_root: true

- type: log
  paths:
    - /var/log/nginx/error.log*
  tags: ["qzh_nginx_error"]
  include_lines: ['\[error\]']

- type: log
  enabled: true
  paths:
    - /softwares/apache-tomcat-10.1.19/logs/*.txt*
  tags: ["qzh_tomcat_access"]
  json.keys_under_root: true

- type: log
  enabled: true
  paths:
    - /softwares/apache-tomcat-10.1.19/logs/*.out*
  tags: ["qzh_tomcat_error"]
  multiline.type: pattern
  multiline.pattern: '^[[:space:]]'
  multiline.negate: false
  multiline.match: after


output.elasticsearch:
  enabled: true
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh_nginx_access-%{+yyyy.MM.dd}"
      when.contains:
        tags: "qzh_nginx_access"
    - index: "qzh_nginx_error-%{+yyyy.MM.dd}"
      when.contains:
        tags: "qzh_nginx_error"
    - index: "qzh_tomcat_access-%{+yyyy.MM.dd}"
      when.contains:
        tags: "qzh_tomcat_access"
    - index: "qzh_tomcat_error-%{+yyyy.MM.dd}"
      when.contains:
        tags: "qzh_tomcat_error"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 0
```

# 16-filestreamjson 解析

```python
vi /etc/filebeat/config/18-filestream-json.yml

filebeat.inputs:
- type: filestream
  paths:
    - /var/log/nginx/access.log*
  tags: ["elk_access"]
  parsers:
    - ndjson:
        keys_under_root: true

- type: filestream
  paths:
    - /var/log/nginx/error.log*
  tags: ["elk_error"]
  include_lines: ['\[error\]']

output.elasticsearch:
  enabled: true
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-nginx-access-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_access"
    - index: "qzh-elk-nginx-error-%{+yyyy.MM.dd}"
      when.contains:
        tags: "elk_error"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 0
```

# 17-filestream 的多行匹配问题

```python
vi /etc/filebeat/config/19-filestream-mutiline.yml

filebeat.inputs:
- type: filestream
  paths:
    - /softwares/apache-tomcat-10.1.19/logs/*.txt
  tags: ["tomcat_access"]
  parsers:
    - ndjson:
        keys_under_root: true

- type: filestream
  paths:
    - /softwares/apache-tomcat-10.1.19/logs/*.out
  tags: ["tomcat_error"]
  parsers:
    - multiline:
        type: pattern
        pattern: '^[[:space:]]'
        negate: false
        match: after

output.elasticsearch:
  enabled: true
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-tomcat-access-%{+yyyy.MM.dd}"
      when.contains:
        tags: "tomcat_access"
    - index: "qzh-elk-tomcat-error-%{+yyyy.MM.dd}"
      when.contains:
        tags: "tomcat_error"

setup.ilm.enabled: false
setup.template.name: "qzh-elk"
setup.template.pattern: "qzh-elk-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 3
  index.number_of_replicas: 0
```

# 02-故障解决思路一 作业

### 整个作业踩坑点

- 文件路径加上末尾加上\*号，以防文件没有内容
- 修改 setup.template.pattern 的时候，有可能这个 pattern 会匹配到多个模板的名字。会引起冲突

```python
vi 20-system-log.yml

filebeat.inputs:
  - type: filestream
    paths:
      - /var/log/secure*
    tags: ["secure"]
  - type: filestream
    paths:
      - /var/log/maillog*
    tags: ["maillog"]
  - type: filestream
    paths:
      - /var/log/yum.log
    tags: ["yum"]
  - type: filestream
    paths:
      - /var/log/firewalld
    tags: ["firewalld"]
  - type: filestream
    paths:
      - /var/log/cron*
    tags: ["cron"]
  - type: filestream
    paths:
      - /var/log/messages*
    tags: ["messages"]

output.elasticsearch:
  enabled: true
  hosts:
    [
      "http://192.168.200.128",
      "http://192.168.200.129",
      "http://192.168.200.130",
    ]
  indices:
    - index: "qzh-elk-system-secure-%{+yyyy.MM.dd}"
      when.contains:
        tags: "secure"
    - index: "qzh-elk-system-maillog-%{+yyyy.MM.dd}"
      when.contains:
        tags: "maillog"
    - index: "qzh-elk-system-yum-%{+yyyy.MM.dd}"
      when.contains:
        tags: "yum"
    - index: "qzh-elk-system-firewalld-%{+yyyy.MM.dd}"
      when.contains:
        tags: "firewalld"
    - index: "qzh-elk-system-cron-%{+yyyy.MM.dd}"
      when.contains:
        tags: "cron"
    - index: "qzh-elk-system-messages-%{+yyyy.MM.dd}"
      when.contains:
        tags: "messages"
setup.ilm.enabled: false
setup.template.name: "qzh-elk-system"
setup.template.pattern: "qzh-elk-system-*"
setup.template.overwrite: true
setup.template.settings:
  index.number_of_shards: 10
  index.number_of_replicas: 0


```

# 06-将数据写入到 redis 环境

```python
(1) 安装redis
vi /etc/redis.conf
....
bind 0.0.0.0
....
requirepass qzh_elk

(2) 重启redis
systemctl restart redis

(3) 登录
redis-cli -a qzh_elk -h 192.168.200.129 --raw -n 5

(5) 将filebeat 数据写入redis
vi /etc/filebeat/config/22-ouput-redis.yml

filebeat.inputs:
  - type: tcp
    max_message_size: 10MiB
    host: "0.0.0.0:9000"

output.redis:
  hosts: ["192.168.200.129:6379"]
  password: 'qzh_elk'
  key: "filebeat_tcp"
  db: 5
  timeout: 3

```

# 09-logstash 环境部署

## 安装 logstash

```
(1) 下载 wget https://artifacts.elastic.co/downloads/logstash/logstash-7.17.3-x86_64.rpm
(2) yum -y localinstall logstash-7.17.3-x86_64.rpm
(3) systemctl start logstash
(4) systemctl enable logstash
(5) ln -sv /usr/share/logstash/bin/logstash /usr/local/bin
```

## 配置

```python
vi /etc/logstash/conf.d/01-stdin-to-stdout.conf

input {
    stdin {}
}

output {
    stdout {}
}

```

# 10-logstsh 收集本地文件注意事项

```python
vi /etc/logstash/conf.d/02-file-input.conf

input {
    file {
        path => ['/tmp/test/*.txt']
        start_position => "beginning"
    }
}

output {
    stdout{}
}
```

# 11-logstash 实现日志聚合

```python
vi /etc/logstash/conf.d/03-tcp.conf

input {
    tcp {
        port => 8888
    }
}

output {
    stdout{

    }
}
```

# 12-logstash 基于 http 案例

```python
vi /etc/logstash/conf.d/04-http.conf

input {
    http {
        port => 8888
    }
    http {
        port => 9999
    }
}

output {
    stdout{

    }
}

```

# 14-logstash 和 redis 对接

```python
vi /etc/logstash/conf.d/05-redis.conf

input {
     redis {
        data_type => "list"
        db => 5
        host => "192.168.200.129"
        key => "filebeat_tcp"
        password => "qzh_elk"
        port => 6379
     }
}

output {
    stdout{

    }
}
```

# 15 filebeat output to logstash

```python
(1) 配置filebeat
vi /etc/filebeat/config/23-output-logstash.yml
filebeat.inputs:
  - type: tcp
    max_message_size: 10MiB
    host: "0.0.0.0:9000"

output.logstash:
  hosts: ["192.168.200.129:5044"]

(2) 配置logstash
vi /etc/logstash/conf.d/06-filebeat-input.conf

input {
      beats {
        port => 5044
      }
}

output {
    stdout{

    }
}

```

# 18 输出到 es

```python
vi /etc/logstash/conf.d/08-output-elasticsearch.conf

input {
    tcp {
      port => 9999
    }
}

output {
     stdout {}
      elasticsearch {
        hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
        index => "qzh-logstash-%{+YYYY.MM.dd}"
      }
}
```

# 03-grok 内置正则

```python
(1)
vi /etc/filebeat/config/24-nginx-to-logstash.yml

filebeat.inputs:
- type: log
  paths:
    - /var/log/nginx/*.log*

output.logstash:
  hosts: ["192.168.200.129:8888"]

(2)
vi /etc/logstash/conf.d/10-grok-filter.conf

input {
    beats {
      type => "beat"
      port => 8888
    }
}

filter {
    grok {
        match => {
            # https://github.com/logstash-plugins/logstash-patterns-core/blob/main/patterns/ecs-v1/httpd
            # HTTPD_COMMONLOG %{IPORHOST:[source][address]} (?:-|%{HTTPDUSER:[apache][access][user][identity]}) (?:-|%{HTTPDUSER:[user][name]}) \[%{HTTPDATE:timestamp}\] "(?:%{WORD:[http][request][method]} %{NOTSPACE:[url][original]}(?: HTTP/%{NUMBER:[http][version]})?|%{DATA})" (?:-|%{INT:[http][response][status_code]:int}) (?:-|%{INT:[http][response][body][bytes]:int}) "(?:-|%{DATA:[http][request][referrer]})" "(?:-|%{DATA:[user_agent][original]})"
            # 192.168.200.1 - - [18/Mar/2024:21:00:03 +0800] "GET /poweredby.png HTTP/1.1" 200 368 "http://192.168.200.129/ABC" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" "-"
            "message" => "%{HTTPD_COMMONLOG}"
        }
    }
}

output {
    stdout {}
    elasticsearch  {
        hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
        index => "qzh-elk-grok-%{+YYYY.MM.dd}"
    }
}
```

# 05-自定义 grok 实战案例

## 案例 1

```python
(1)
vi /etc/logstash/conf.d/patterns/1

POSTFIX_QUEUEID [0-9A-F]{10,11}

(2)
vi /etc/logstash/conf.d/11-grok-custom-filter.conf

input {
    stdin {}
}

filter {
    grok {
        patterns_dir => ["/etc/logstash/conf.d/patterns"]
        match => { "message" => "%{SYSLOGBASE} %{POSTFIX_QUEUEID:queue_id}: %{GREEDYDATA:syslog_message}" }
    }
}

output {
    stdout {}
}

(3) 启动logstash，输入：Jan  1 06:25:43 mailserver14 postfix/cleanup[21403]: BEF25A72965: message-id=<20130101142543.5828399CCAF@mailserver14.example.com>

(4) 结果输出：
{
               "pid" => "21403",
          "queue_id" => "BEF25A72965",
           "message" => "Jan  1 06:25:43 mailserver14 postfix/cleanup[21403]: BEF25A72965: message-id=<20130101142543.5828399CCAF@mailserver14.example.com>",
              "host" => "qzh2.abc.com",
        "@timestamp" => 2024-03-18T14:52:43.616Z,
         "logsource" => "mailserver14",
    "syslog_message" => "message-id=<20130101142543.5828399CCAF@mailserver14.example.com>",
         "timestamp" => "Jan  1 06:25:43",
          "@version" => "1",
           "program" => "postfix/cleanup"
}
```

## 案例 2

```python
(1)
vi /etc/logstash/conf.d/patterns/1

POSTFIX_QUEUEID [0-9A-F]{10,11}
QZH_ELK_EMAIL [\w.%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}
(2)
vi /etc/logstash/conf.d/11-grok-custom-filter.conf

input {
    stdin {}
}

filter {
    grok {
        patterns_dir => ["/etc/logstash/conf.d/patterns"]
        match => { "message" => "%{POSTFIX_QUEUEID:queue_id}: message-id=<%{QZH_ELK_EMAIL:user_mail}>" }
    }
}

output {
    stdout {}
}

(3) 启动logstash，输入：Jan  1 06:25:43 mailserver14 postfix/cleanup[21403]: BEF25A72965: message-id=<20130101142543.5828399CCAF@mailserver14.example.com>

(4) 结果输出：
{
      "@version" => "1",
    "@timestamp" => 2024-03-18T14:55:20.956Z,
       "message" => "Jan  1 06:25:43 mailserver14 postfix/cleanup[21403]: BEF25A72965: message-id=<20130101142543.5828399CCAF@mailserver14.example.com>",
     "user_mail" => "20130101142543.5828399CCAF@mailserver14.example.com",
          "host" => "qzh2.abc.com",
      "queue_id" => "BEF25A72965"
}
```

# 06-filter 插件字段 remove_field

# 07-filter 通用字段 add_field 案例

# 08-filebeat 的通用字段案例

```python
(1)
filebeat /etc/filebeat/config/24-nginx-to-logstash.yml

(2)
vi /etc/logstash/conf.d/12-grok-to-es.conf

input {
    beats {
      type => "beat"
      port => 8888
    }
}

filter {
    grok {
        match => {
            "message" => "%{HTTPD_COMMONLOG}"
        }
        remove_field => [ "agent", "tags", "ecs", "@version" , "input", "log"]
        add_field => {
            "elk-clientip" => "clientip ---> %{clientip}"
            "elk-name" => "dddddddddw"
        }
        add_tag => [ "taggedy_tag"]
    }

}

output {
     stdout {}
    elasticsearch  {
        hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
        index => "qzh-elk-grok-%{+YYYY.MM.dd}"
    }
}

(3) logstash -rf /etc/logstash/conf.d/12-grok-to-es.conf
```

# 03-logstash 的 filter 插件 date 实战

```python
vi /etc/logstash/conf.d/13-beat-grok_date-es.conf

input {
    beats {
      type => "beat"
      port => 8888
    }
}

filter {
    grok {
        match => {
            "message" => "%{HTTPD_COMMONLOG}"
        }
        remove_field => [ "host", "@version" , "ecs", "tags",  "agent",  "input", "log"]
    }
    # 匹配 timestamp 的值的格式为 19/Mar/2024:20:52:25 +0800
    # 然后覆盖@timestamp 字段的值
    # kibana 的时间段筛选，默认根据 @timestamp 字段
    date {
        match => ["timestamp", "dd/MMM/yyyy:HH:mm:ss Z"],
        target => "qzh_elk_access_time"
    }
}

output {
    stdout {}
    elasticsearch  {
        hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
        index => "qzh-elk-grok-%{+YYYY.MM.dd}"
    }
}
```

# 05-geoip 分析客户端的 IP 地理位置实战案例

```
vi /etc/logstash/conf.d/14-beat-geoip-es.conf
input {
    beats {
      type => "beat"
      port => 8888
    }
}

filter {
    grok {
        match => {
            "message" => "%{HTTPD_COMMONLOG}"
        }
        remove_field => [ "host", "@version" , "ecs", "tags",  "agent",  "input", "log"]
    }

    date {
        match => ["timestamp", "dd/MMM/yyyy:HH:mm:ss Z"]
    }

    geoip {
        source => "clientip"
        fields => ["city_name", "country_name", "ip"] # 从geo 信息中提取关键字段
        target => "qzh_elk_geo" # 存出上面提取的字段
    }
}

output {
    stdout {}
    elasticsearch  {
        hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
        index => "qzh-elk-geoip-%{+YYYY.MM.dd}"
    }
}
```

# 06-使用 logstash 分析客户的设备信息

```python
(1) 生成json 格式的nginx日志


vi /etc/nginx/nginx.conf

    #  log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
    #                   '$status $body_bytes_sent "$http_referer" '
    #                   '"$http_user_agent" "$http_x_forwarded_for"';

    #  access_log  /var/log/nginx/access.log  main;
    log_format qzh_nginx_json '{"qzh_timestamp":"$time_iso8601",' #日志访问时间不要用@timestamp，避免于logstash 中的字段冲突

        '"host":"$server_addr",'
        '"clientip":"$remote_addr",'
        '"size":$body_bytes_sent,'
        '"responsetime":"$request_time",'
        '"upstreamtime":"$upstream_response_time",'
        '"upstreamhost":"$upstream_addr",'
        '"http_host":"$host",'
        '"domain":"$host",'
        '"xff":"$http_x_forwarded_for",'
        '"referer":"$http_referer",'
        '"tcp_xff":"$http_x_real_ip",'
        '"http_user_agent":"$http_user_agent",'
        '"status":"$status"}';

    access_log /var/log/nginx/access.log qzh_nginx_json;

（2）
vi /etc/filebeat/config/25-nginx-to-logstash.yml

filebeat.inputs:
- type: log
  paths:
    - /var/log/nginx/access.log*
  json.keys_under_root: true # 在filbeat 中把日志字段从 message 字段中 提取到根

output.logstash:
  hosts: ["192.168.200.129:8888"]

(3) 使用logstash useragent 插件，提取 http_user_agent 字段中的信息
vi /etc/logstash/conf.d/15-beat-useragent-es.conf

input {
    beats {
      type => "beat"
      port => 8888
    }
}

filter {
    mutate {

        remove_field => [ "host", "@version" , "ecs", "tags", "agent", "input", "log"]
    }

    # nginx 时间格式 2024-03-20T21:30:25+08:00
    date {
        match => ["qzh_timestamp", "yyyy-MM-dd'T'HH:mm:ssZZ"]
    }

    geoip {
        source => "clientip"
        fields => ["city_name", "country_name", "ip"]
        target => "qzh_elk_geo"
    }

    useragent {
        source => "http_user_agent"
        target => "qzh_elk_useragent"
    }
}

output {
    stdout {}
    elasticsearch  {
        hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
        index => "qzh-elk-useragent-%{+YYYY.MM.dd}"
    }
}
```

# 07-使用 python 脚本生成测试数据

```
vi generate_log.py
```

```python

#!/usr/bin/env python
# -*- coding: UTF-8 -*
# @author : oldboyedu-linux80

import datetime
import random
import logging
import time
import sys

LOG_FORMAT = "%(levelname)s %(asctime)s [com.oldboyedu.%(module)s] - %(message)s "
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
# 配置root的logging.Logger实例的基本配置
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, datefmt=DATE_FORMAT, filename=sys.argv[1], filemode='a')
actions = ["浏览⻚⾯", "评论商品", "加⼊收藏", "加⼊购物⻋", "提交订单", "使⽤优惠券", "领取优惠券", "搜索", "查看订单", "付款", "清空购物⻋"]
while True:
  time.sleep(random.randint(1, 5))
  user_id = random.randint(1, 10000)
  # 对⽣成的浮点数保留2位有效数字.
  price = round(random.uniform(15000, 30000),2)
  action = random.choice(actions)
  svip = random.choice([0,1])
  logging.info("DAU|{0}|{1}|{2}|{3}".format(user_id, action,svip,price))

```

```
nohup python generate_log.py  /tmp/app.log &>/dev/null &
```

```
tail -100f /tem/app.log
```

# 08-mutate 组件常用字段介绍

```
(1) python generate_log.py
(2) vi /etc/filebeat/config/26-apps-to-logstash.yml

filebeat.inputs:
- type: log
  paths:
    - /tmp/app.log*

output.logstash:
  hosts: ["192.168.200.129:8888"]


(3) vi /etc/logstash/conf.d/17-beat-mutate-es.conf

input {
    beats {
      type => "beat"
      port => 8888
    }
}

filter {
    mutate {
        remove_field => ["@timestamp", "host", "@version" , "ecs", "tags", "agent", "input", "log"]

        split => {
            message =>  "|"
        }

        add_field => {
            "user_id" => "%{[message][1]}"
            "action" => "%{[message][2]}"
            "svip" => "%{[message][3]}"
            "price" => "%{[message][4]}"
        }

        strip => ["price"]
    }
    mutate {

        convert => {
            "user_id" => "integer"
             "svip" => "boolean"
             "price" => "float"
        }
    }
}

output {
    stdout {}
    elasticsearch  {
        hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
        index => "qzh-elk-mutate-%{+YYYY.MM.dd}"
    }
}
```

# 11-ELFK 架构多 if 分支判断多综合案例

```
vi /etc/logstash/conf.d/18-beats_tcp-filter-es.conf

input {
    beats {
      type => "beat"
      port => 8888
    }
    tcp {
        type => "tcp"
        port => 9999
    }
}

filter {
    mutate {
        add_field => { "qzh_elk_common_data" => "This is a common field for all kind of input logs" }
    }

    if [type] == "beat" {
        mutate {
            remove_field => [ "host", "@version" , "ecs", "tags", "agent", "input", "log"]
        }

        geoip {
            source => "clientip"
            fields => ["city_name", "country_name", "ip"]
            target => "qzh_elk_geoip"
        }

        useragent {
            source => "http_user_agent"
            target => "qzh_elk_useragent"
        }

        date {
            match => ["qzh_timestamp", "yyyy-MM-dd'T'HH:mm:ssZZ"]
        }
    }

    if [type] == "tcp" {
        mutate {
            remove_field => [ "port", "host", "@version"]
        }

       mutate {
            split => {
                message => "|"
            }
            add_field => {
                "user_id" => "%{[message][1]}"
                "action" => "%{[message][2]}"
                "svip" => "%{[message][3]}"
                "price" => "%{[message][4]}"
            }
            remove_field => [ "message" ]
       }
       mutate {
            strip => ["svip", "price"]
            convert => {
                "user_id" => "integer"
                "svip" => "boolean"
                "price" => "float"
            }
       }

    }
}

output {
    stdout {}
    if [type] == "beat" {
        elasticsearch  {
            hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
            index => "qzh-elk-beat-%{+YYYY.MM.dd}"
        }
    }else if [type] == "tcp" {
        elasticsearch  {
            hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
            index => "qzh-elk-tcp-%{+YYYY.MM.dd}"
        }
    }
}
```

# 02-作业讲解之 nginx 指定分片数量写入 ES

# 03-作业讲解之 tomcat 指定分片写入 ES 集群

# 04-作业讲解 logstash 的 bug 复现

```
(1)
vi /etc/filebeat/config/27-nginx-input.yml

filebeat.inputs:
  - type: log
    paths:
      - /var/log/nginx/access.log*
    json.keys_under_root: true

output.logstash:
  hosts: ["192.168.200.129:8888"]



(2)
vi /etc/filebeat/config/27-tomcat-input.yml

filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /softwares/apache-tomcat-10.1.19/logs/*.txt*
    json.keys_under_root: true

output.logstash:
  hosts: ["192.168.200.129:8889"]

(3)
vi /etc/filebeat/config/27-python-input.yml

filebeat.inputs:

  - type: log
    paths:
      - /tmp/app.log*
    tags: ["qzh_python_access"]

output.logstash:
  hosts: ["192.168.200.129:8890"]

(4)
vi /etc/logstash/conf.d/20-nginx-tomcat-app-es.conf

input {
    beats {
      type => "nginx-beat"
      port => 8888
    }
     beats {
      type => "tomcat-beat"
      port => 8889
    }
    beats {
      type => "python-beat"
      port => 8890
    }
}

filter {
    mutate {
        add_field => { "qzh_elk_common_data" => "This is a common field for all kind of input logs" }
    }

    mutate {
        remove_field => [ "host", "@version", "ecs", "tags", "agent", "input", "log"]
    }

    if [type] == "nginx-beat" {
        geoip {
            source => "clientip"
            fields => ["city_name", "country_name", "ip"]
            target => "qzh_elk_geoip"
        }

        useragent {
            source => "http_user_agent"
            target => "qzh_elk_useragent"
        }

          date {
                match => ["qzh_timestamp", "yyyy-MM-dd'T'HH:mm:ssZZ"]
            }


    }

    if [type] == "tomcat-beat" {
          geoip {
            source => "clientip"
            fields => ["city_name", "country_name", "ip"]
            target => "qzh_elk_geoip"
        }

        useragent {
            source => "http_user_agent"
            target => "qzh_elk_useragent"
        }


    }

    if [type] == "python-beat" {
       mutate {
            split => {
                message => "|"
            }
            add_field => {
                "user_id" => "%{[message][1]}"
                "action" => "%{[message][2]}"
                "svip" => "%{[message][3]}"
                "price" => "%{[message][4]}"
            }
            remove_field => [ "message" ]
       }
       mutate {
            strip => ["svip", "price"]
            convert => {
                "user_id" => "integer"
                "svip" => "boolean"
                "price" => "float"
            }
       }
    }
}

output {
    stdout {}
    if [type] == "nginx-beat" {
        elasticsearch {
            hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
            index => "qzh_elk_nginx-%{+YYYY.MM.dd}"
        }
    }else if [type] == "python-beat" {
        elasticsearch {
            hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
            index => "qzh_elk_python-%{+YYYY.MM.dd}"
        }
    }else if [type] == "tomcat-beat" {
         elasticsearch {
            hosts => ["http://192.168.200.128:9200", "http://192.168.200.129:9200", "http://192.168.200.130:9200"]
            index => "qzh_elk_tomcat-%{+YYYY.MM.dd}"
        }
    }
}
```

# 10-ES 集群 oracle JDK 环境部署

```
(1) wget https://download.oracle.com/java/22/latest/jdk-22_linux-x64_bin.tar.gz
(2) tar xf jdk-22_linux-x64_bin.tar.gz -C /softwares
(3) cd /softwares && ln -sv jdk-22 jdk
(4) cat > /etc/profile.d/qzh_elk.sh <<'EOF'
 #!/bin/bash
 export JAVA_HOME=/softwares/jdk
 export PATH=$PATH:$JAVA_HOME/bin
 EOF
 source /etc/profile.d/qzh_elk.sh
(5) java -version
(6) 同步到其他节点

data_rsync.sh /soft/jdk-22
data_rsync.sh /soft/jdk
data_rsync.sh /etc/profile.d/qzh_elk.sh

(7) 其他节点执行
source /etc/profile.d/qzh_elk.sh
java -version

```

# 11-ES 单节点及排错故障案例

```
(1) wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-7.17.13-linux-x86_64.tar.gz
(2)  tar xf elasticsearch-7.17.3-linux-x86_64.tar.gz -C /softwares/
(3)  cd /softwares/ && ln -sv elasticsearch-7.17.3 es
(4) cat >> /etc/profile.d/qzh_elk.sh <<'EOF'
 export ES_HOME=/softwares/es
 export PATH=$PATH:$ES_HOME/bin
 EOF

 source /etc/profile.d/qzh_elk.sh

(5) useradd qzh_elk
(6) chown qzh_elk:qzh_elk -R /softwares/elasticsearch-7.17.3/
(8) vim /softwares/es/config/elasticsearch.yml
...
 cluster.name: elk_cluster
 network.host: 0.0.0.0
 discovery.seed_hosts: ["192.168.200.128"]
 cluster.initial_master_nodes: ["192.168.200.128"]
...

(9) cat > /etc/security/limits.d/elk.conf <<'EOF'
 *       soft    nofile     65535
 *       hard    nofile    131070
 EOF

(10) cat > /etc/sysctl.d/elk.conf <<'EOF'
 vm.max_map_count = 262144
 EOF
 sysctl -f /etc/sysctl.d/elk.conf
 sysctl -q vm.max_map_count

(11) su qzh_elk
(12) elasticsearch
(13) curl 192.168.200.128:9200/_cat/nodes
```

# 12-jps,jmap 及 ES 的堆内存大修改

```
(1)修改堆内存⼤⼩
su qzh_elk
vim /oldboyedu/softwares/es/config/jvm.options
 ...
 # 堆内存设置不建议超过32G.
 -Xms256m
 -Xmx256m

 (2)重启服务
kill `jps | grep Elasticsearch | awk '{print $1}'`
elasticsearch

 (3)验证堆内存的⼤⼩
jmap -heap `jps | grep Elasticsearch | awk '{print $1}'`

```

# 14-ES 的启动脚本编写及排错实战

```
(1) vi /usr/lib/systemd/system/es.service

[Unit]
Description=Oldboyedu linux80 ELK
After=network.target

[Service]
Type=forking
ExecStart=/softwares/es/bin/elasticsearch -d
Restart=no
User=qzh_elk
Group=qzh_elk
LimitNOFILE=131070
[Install]
WantedBy=multi-user.target


(2) systemctl daemon-reload
(3) systemctl restart es
```

# 15-ES 集群环境部署及排错实战案例

```
(1)
mkdir -pv /qzh_elk/{data,logs}
install -d /qzh_elk/{data,logs}/es7 -o qzh_elk -g qzh_elk


(2) vim /softwares/es/config/elasticsearch.yml
...
 path.data: /qzh_elk/data/es7
 path.logs: /qzh_elk/logs/es7
 discovery.seed_hosts: ["192.168.200.128", "192.168.200.129", "192.168.200.130"]
 cluster.initial_master_nodes: ["192.168.200.128", "192.168.200.129", "192.168.200.130"]
...

(2)
data_rsync.sh /softwares/elasticsearch-7.17.13/
data_rsync.sh /softwares/es/
data_rsync.sh /etc/profile.d/qzh_elk_jdk.sh
data_rsync.sh /etc/sysctl.d/elk.conf
data_rsync.sh /etc/security/limits.d/elk.conf

(7) 在其他节点上执行：
source /etc/profile.d/qzh_elk_jdk.sh
sysctl -f /etc/sysctl.d/elk.conf
useradd qzh_elk
mkdir -pv /qzh_elk/{data,logs}
install -d /qzh_elk/{data,logs}/es7 -o qzh_elk -g qzh_elk
systemctl start es
```

# 16-kibana 环境部署

```
(1) wget https://artifacts.elastic.co/downloads/kibana/kibana-7.17.3-linux-x86_64.tar.gz
(2) tar xf kibana-7.17.3-linux-x86_64.tar.gz -C  /softwares/
(3) cd /softwares/ && ln -sv kibana-7.17.3-linux-x86_64 kibana
(4) vi /etc/profile.d/elk_kibana.sh
export KIBANA_HOME=/softwares/kibana
 export PATH=$PATH:$KIBANA_HOME/bin
(5) source /etc/profile.d/elk_kibana.sh
(6) chown qzh_elk:qzh_elk -R /softwares/kibana-7.17.3-linux-x86_64/
(7) vi /softwares/kibana/config/kibana.yml
(8) su qzh_elk
(9) kibana
```

### kibana service 文件

```
(1) vi /usr/lib/systemd/system/kibana.service

[Unit]
Description=Kibana
After=network.target

[Service]
Type=simple
User=qzh_elk
Group=qzh_elk
ExecStart=/softwares/kibana/bin/kibana
Restart=always
StandardOutput=null
StandardError=null
[Install]
WantedBy=multi-user.target


(2) systemctl daemon-reload
(3) systemctl restart es
```

# 3.管理索引的 api

## 3.1 查看索引信息

```
GET http://192.168.200.128:9200/_cat/indices  # 查看全部的索引信息
GET http://192.168.200.128:9200/_cat/indices?v  # 查看表头信息
GET http://192.168.200.128:9200/_cat/indices/qzh_elk_postman01?v  # 查看单个索引
GET http://192.168.200.128:9200/qzh_elk_python-2024.03.23  # 查看单个索引的详细信息
```

## 3.2 创建索引

```
PUT http://192.168.200.128:9200/qzh_elk_postman01
{
    "settings": {
        "index" : {
            "number_of_shards": 3,
            "number_of_replicas": 0
        }
    }
}
```

## 3.3 修改索引

```
PUT http://192.168.200.128:9200/qzh_elk_postman01/_settings
 {
    "number_of_replicas": 0
 }
```

## 3.4 删除索引

```
DELETE http://192.168.200.128:9200/qzh_elk_postman01
```

## 3.5 索引别名

```
POST http://192.168.200.128:9200/_aliases # 添加索引别名
{
    "actions": [
        {
            "add": {
                "index": "qzh_elk_postman01",
                "alias": "qzh_eli_postman01_aliasssss"
            }
        }
    ]
}

GET http://192.168.200.128:9200/_aliases # 查看索引别名

POST http://192.168.200.128:9200/_aliases # 删除索引别名
{
    "actions": [
        {
            "remove": {
                "index": "qzh_elk_postman01",
                "alias": "qzh_eli_postman01_aliasssss"
            }
        }
    ]
}

POST http://192.168.200.128:9200/_aliases # 修改索引别名
{
    "actions": [
        {
            "remove": {
                "index": "qzh_elk_postman01",
                "alias": "qzh_eli_postman01_aliasssss"
            }
        },
         {
            "add": {
                "index": "qzh_elk_postman01",
                "alias": "qzh_eli_postman01_alias_change"
            }
        }
    ]
}

```

## 3.6 关闭索引

```
POST http://192.168.200.128:9200/qzh_elk_postman01/_close
POST http://192.168.200.128:9200/qzh_elk_postman*/_close #通配符
```

## 3.7 打开索引

```
POST http://192.168.200.128:9200/qzh_elk_postman01/_open
POST http://192.168.200.128:9200/qzh_elk_postman01/_open
```

# 4. 文档管理

## 4.1 创建文档

```
POST http://192.168.200.128:9200/qzh_elk_postman01/_doc
{
    "name": "qzh",
    "age": 18
}

POST http://192.168.200.128:9200/qzh_elk_postman01/_doc/1001 # 指定文档id
{
    "name": "qzh",
    "age": 28
}
```

## 4.2 查看文档

```
  GET http://192.168.200.128:9200/qzh_elk_postman01/_search # 查看所有文档
GET http://192.168.200.128:9200/qzh_elk_postman01/_doc/1001 # 02-查看某个文档（根据id）
GET http://192.168.200.128:9200/qzh_elk_postman01/_doc/1001 # 03-查看文档是否存在
```

## 4.3 修改文档

```
PUT http://192.168.200.128:9200/qzh_elk_postman01/_doc/1001  # 01-全局更新
{
    "name": "qzh",
    "age": 28,
    "job": "farmer"
}

PUT http://192.168.200.128:9200/qzh_elk_postman01/_doc/1001/_update # 02-局部更新
{
    "doc": {
        "name": "qqqzh"
    }
}
```

## 4.5 文档的批量操作

```
POST http://192.168.200.128:9200/_bulk # 01-文档批量创建
{ "create" : { "_index" : "qzh_elk_postman01" } }
{ "name" : "zzz" }
{ "create" : { "_index" : "qzh_elk_postman01" } }
{ "name" : "qqqq" }

POST http://192.168.200.128:9200/_bulk # 02-文档批量删除
{ "delete" : { "_index" : "qzh_elk_postman01", "_id" : "EOYWe44Bbjyvf0Vpi5zw" } }
{ "delete" : { "_index" : "qzh_elk_postman01", "_id" : "EeYWe44Bbjyvf0Vpi5zw" } }


POST http://192.168.200.128:9200/_bulk # 03-文档批量修改
{ "update" : { "_index" : "qzh_elk_postman01", "_id" : "1" } }
{ "doc" : {"field1": "uuuuu"}}
{ "update" : { "_index" : "qzh_elk_postman01", "_id" : "2" } }
{ "doc" : {"field1": "ddddd"}}

POST http://192.168.200.128:9200/_bulk # 03-文档批量查看
{ "update" : { "_index" : "qzh_elk_postman01", "_id" : "1" } }
{ "doc" : {"field1": "uuuuu"}}
{ "update" : { "_index" : "qzh_elk_postman01", "_id" : "2" } }
{ "doc" : {"field1": "ddddd"}}


```

# 5. 使⽤映射⾃定义数据类型

# 5.1 IP

```
PUT http://192.168.200.128:9200/qzh_elk_postman05
{
    "mappings": {
        "properties": {
            "ip_addr": {
                "type": "ip"
            }
        }
    }
}
```

# 3 DSL-全文检索 match 及完全匹配

- 分词查询

```
GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "match": {
      "brand": "dell"
    }
  }
}
```

- 分页，查看指定字段

```
GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "match_all": {}
  },
  "size": 7,
  "from": 28,
  "_source": ["brand", "price"]
}
```

- 查询包含指定字段的文档

```
GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "exists": {
      "field": "title"
    }
  }
}
```

- 基于指定字段排序

```
GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "match_phrase": {
      "brand": "苹果"
    }
  },
  "sort": [
    {
      "price": {
        "order": "asc"
      }
    }
  ]
}
```

- 多条件查询

```
GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "match_phrase": {
            "brand": "苹果"
          }
        },
        {
          "match": {
            "price": "5499"
          }
        }
      ]
    }
  }
}


GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "bool": {
      "must_not": [
        {
          "match_phrase": {
            "brand": "苹果"
          }
        },
        {
          "match": {
            "price": "5499"
          }
        }
      ]
    }
  }
}


GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "bool": {
      "should": [
        {
          "match_phrase": {
            "brand": "苹果"
          }
        },
        {
          "match": {
            "price": "3399"
          }
        }
      ]
    }
  }
}

```

- 范围查询-filter

```
GET /qzh_elk_goods-2024.03.30/_search
{

  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "brand": "外星人"
          }
        }
      ],
      "filter": [
        {
          "range": {
            "price": {
              "gte": 5000,
              "lte":8000
            }
          }
        }
      ]
    }
  }
}


```

- 精确匹配查询

```
GET /qzh_elk_goods-2024.03.30/_search
{

  "query": {
    "term": {
      "price": {
        "value": "4699"
      }
    }
  }
}
```

- 多词搜索

```
 {
    "query": {
        "bool": {
            "must": [
                {
                    "match": {
                        "title": {
                            "query": "显示器曲⾯",
                            "operator": "and"
                        }
                    }
                }
            ]
        }
    },
    "highlight": {
        "pre_tags": [
            "<h1>"
        ],
        "post_tags": [
            "</h1>"
        ],
        "fields": {
            "title": {}
        }
    }
 }
```

- 权重

```
GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "brand": {
              "query": "小苹"
            }
          }
        }
      ],
      "should": [
        {
          "match_phrase": {
            "title": {
              "query": "防水",
              "boost": 12
            }
          }
        },
        {
          "match_phrase": {
            "title": {
              "query": "黑色",
              "boost": 10
            }

          }
        }
      ]
    }
  },
  "highlight": {
    "fields": {
      "title": {},
      "brand": {}
    }
  },
  "_source": ""
}

```

- 聚合函数

```
GET /qzh_elk_goods-2024.03.30/_search
{
  "aggs": {
    "qzh_brand_group": {
      "terms": {
        "field": "brand.keyword",
        "size": 10
      }
    }
  },
  "size": 0
}

GET /qzh_elk_goods-2024.03.30/_search
{
  "aggs": {
    "qzh_price_max": {
      "max": {
        "field": "price"
      }
    }
  },
  "size": 0
}

GET /qzh_elk_goods-2024.03.30/_search
{
  "aggs": {
    "qzh_price_min": {
      "min": {
        "field": "price"
      }
    }
  },
  "size": 0
}

GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "match_phrase": {
      "brand": "小米"
    }
  },
  "aggs": {
    "qzh_price_avg": {
      "avg": {
        "field": "price"
      }
    }
  },
  "size": 0
}

GET /qzh_elk_goods-2024.03.30/_search
{
  "query": {
    "match_phrase": {
      "brand": "小米"
    }
  },
  "aggs": {
    "qzh_price_avg": {
      "sum": {
        "field": "price"
      }
    }
  },
  "size": 0
}



```

# 查看集群健康状态

```
GET /_cluster/health?level="indices"
```

# 集群迁移

- 基于 reindex

```
POST http://192.168.200.128:9200/_reindex  # 不同⼀个集群迁移索引
{
    "source": {
        "index": "qzh_elk_goods",
        "remote": {
            "host": "http://192.168.200.131:9200"
        },
        "query": {
            "match_phrase": {
                "brand": "Dell"
            }
        }
    },
    "dest": {
        "index": "qzh_elk_goods_new"
    }
 }
```

- 基于 logstash

```
input {
  elasticsearch {
    index => "qzh_elk_goods"
    hosts => "http://192.168.200.131:9200"
    query => '{ "query": { "match_phrase": { "brand": "dell" } }}'
  }
}

output {
  stdout { }
  elasticsearch {
    index => "qzh_elk_goods_new"
    hosts => "192.168.200.128:9200"
  }
}
```

- 修改集群的配置信息

```
PUT http://192.168200.128200/_cluster/settings
{
  "transient": {
    "cluster.routing.allocation.enable": "none"
  }
}

相关参数说明:
 "cluster.routing.allocation.enable":
    "all":
        允许分配 主分片和副本分片  到node上
    "primaries"
        仅允许分配 主分⽚ 到node上
    "new_primaries"
        仅允许新创的 建索引分配主分⽚。
    "none":
        不允许分配任何类型的分片。
```

- 集群状态

```
(1)查看集群的状态信息
GET /_cluster/state

(2)只查看节点信息。
GET /_cluster/state/nodes

(3)查看nodes,version,routing_table这些信息，并且查看以"qzh_elk*"开头的所有索引
GET /_cluster/state/nodes,version,routing_table/qzh_elk*
```

- 集群统计

```
(1)查看统计信息
GET /_cluster/stats

(2) node 信息
GET /_cluster/stats/nodes/zkVOMsPoReiNfPHJSUyQMg
```

- 集群分片情况

```
(1)分析teacher索引的0号分⽚未分配的原因。
GET /_cluster/allocation/explain
 {
  "index": "qzh_elk_goods",
  "shard": 0,
  "primary": true
 }
```

- 集群分⽚重路由

```
POST /_cluster/reroute  # 将"qzh_elk_goods"索引的0号分⽚从 qzh.abc2.com 节点移动到 qzh.abc1.com 节点。
{
    "commands": [
        {
            "move": {
                "index": "qzh_elk_goods",
                "shard": 0,
                "from_node": "qzh.abc2.com",
                "to_node": "qzh.abc1.com"
            }
        }
    ]
}

POST /_cluster/reroute  # 取消副本分⽚的分配，其副本会 重新初始化分配。
{
    "commands": [
        {
            "cancel": {
                "index": "qzh_elk_goods",
                "shard": 0,
                "node": "elk101.oldboyedu.com"
            }
        }
    ]
 }
```

# ES 开启 TSL 认证及 postman 插件登录认证

```
(1) 在每个节点执行

/usr/share/elasticsearch/bin/elasticsearch-certutil cert -out /etc/elasticsearch/elasticsearch-certutil.p12 -pass ""
chomd 777 /etc/elasticsearch/elasticsearch-certutil.p12

(2)
vi /etc/elasticsearch/elasticsearch.yml

...
xpack.security.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.transport.ssl.verification_mode: certificate
xpack.security.transport.ssl.keystore.path: /etc/elasticsearch/elasticsearch-certutil.p12
xpack.security.transport.ssl.truststore.path: /etc/elasticsearch/elasticsearch-certutil.p12
...

(3) 同步
data_rsync.sh /etc/elasticsearch/elasticsearch-certutil.p12
data_rsync.sh /etc/elasticsearch/elasticsearch.yml

(4) 集群重启
systemctl restart elasticsearch

(5) 生成随机密码

/usr/share/elasticsearch/bin/elasticsearch-setup-passwords auto

Changed password for user apm_system
PASSWORD apm_system = Q0vgAu9ubJpTfIEfjmJH

Changed password for user kibana_system
PASSWORD kibana_system = VTeowtA1KBXte5yqpzLU

Changed password for user kibana
PASSWORD kibana = VTeowtA1KBXte5yqpzLU

Changed password for user logstash_system
PASSWORD logstash_system = z0tq8tAgAc02MkRVpzxO

Changed password for user beats_system
PASSWORD beats_system = WCaoyeIboYc8SugGhQWp

Changed password for user remote_monitoring_user
PASSWORD remote_monitoring_user = 7uuCuSK1ixOEwsXzKDH2

Changed password for user elastic
PASSWORD elastic = LLWyqSxYQpFHEnKpDdOC

(6) 配置kibana
vi /etc/kibana/kibana.yml


elasticsearch.username: "elastic"
elasticsearch.password: "LLWyqSxYQpFHEnKpDdOC"

(7) 重启kibana
systemctl restart kibana
```
