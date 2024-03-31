const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  nodes: [
    'http://192.168.200.128:9200',
    'http://192.168.200.129:9200',
    'http://192.168.200.130:9200'
  ],
  auth: {
    username: 'elastic',
    password: 'your_password'
  }
});

async function bulkIndex() {
  const docs = [
    {
      id: 10010,
      name: '新男孩',
      age: 45,
      hobby: ['⼲饭', '⼲菜', '⼲⼯作'],
      ip_addr: '10.0.0.101',
      email: 'oldboy@oldboyedu.com'
    },
    {
      id: 10011,
      name: '李导',
      age: 32,
      hobby: ['唱', '跳', 'rap', '篮球'],
      email: 'lidao@oldboyedu.com',
      ip_addr: '10.0.0.201'
    },
    {
      id: 100012,
      name: '赵嘉欣',
      age: 24,
      hobby: ['吃饭', '睡觉', '打豆豆'],
      email: 'zhaojiaxin@oldboyedu.com',
      ip_addr: '10.0.0.222'
    }
  ];

  try {
    const { body: response } = await client.bulk({
      index: 'qzh_elk_nodejs_2024',
      body: docs.flatMap(doc => [{ index: {} }, doc])
    });

    if (response.errors) {
      const erroredDocuments = [];
      response.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: docs[i]
          });
        }
      });
      console.error('Errored documents:', erroredDocuments);
    }

    console.log('Successfully indexed documents:', response.items.length);
  } catch (error) {
    console.error('Error during bulk indexing:', error);
  } finally {
    await client.close();
  }
}

bulkIndex();
