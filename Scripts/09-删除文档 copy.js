const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  nodes: [
    'http://192.168.200.128:9200',
    'http://192.168.200.129:9200',
    'http://192.168.200.130:9200'
  ]
});

async function searchDocuments() {
  try {
    const result = await client.delete({
      index: 'qzh_elk_nodejs_2024',
      id: "cIPpko4B8TcErZBxbQhA",
    });

    console.error('result:', JSON.stringify(result));
  } finally {
    await client.close();
  }
}

searchDocuments();
