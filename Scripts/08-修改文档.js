const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  nodes: [
    'http://192.168.200.128:9200',
    'http://192.168.200.129:9200',
    'http://192.168.200.130:9200'
  ]
});

async function searchDocuments() {
  const newDoc = {
    doc: {
      ip_addr: '127.0.0.1'
    }
  };

  try {
    const result = await client.update({
      index: 'qzh_elk_nodejs_2024',
      id: "cIPpko4B8TcErZBxbQhA",
      body: newDoc
    });

    console.error('result:', JSON.stringify(result));
  } finally {
    await client.close();
  }
}

searchDocuments();
