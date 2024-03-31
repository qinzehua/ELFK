const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  nodes: [
    'http://192.168.200.128:9200',
    'http://192.168.200.129:9200',
    'http://192.168.200.130:9200'
  ]
});

async function searchDocuments() {
  doc1 = {'ids': ["c4PSko4B8TcErZBxxAcn", "coPSko4B8TcErZBxxAcn"]}

  try {
    const result = await client.mget({
      index: 'qzh_elk_nodejs_2024',
      body: doc1
    });

    console.error('result:', JSON.stringify(result));
  } finally {
    await client.close();
  }
}

searchDocuments();
