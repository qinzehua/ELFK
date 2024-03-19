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