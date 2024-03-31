const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  nodes:  [
    'http://192.168.200.128:9200',
    'http://192.168.200.129:9200',
    'http://192.168.200.130:9200'
  ]
});

async function indexDocument() {
  const msgBody = {
    name: 'Jason Yin',
    ip_addr: '120.53.104.136',
    blog: 'https://blog.yinzhengjie.com/',
    hobby: ['k8s', 'docker', 'elk'],
    email: 'yinzhengjie@oldboyedu.com',
    id: 10086
  };

  try {
    const result = await client.index({
      index: 'qzh_elk_nodejs_2024',
      body: msgBody
    });
    console.log(result);
  } catch (error) {
    console.error(error);
  } finally {
    await client.close();
  }
}

indexDocument();
