const { Client } = require('@elastic/elasticsearch');
const client = new Client({
  nodes: [
    'http://192.168.200.128:9200',
    'http://192.168.200.129:9200',
    'http://192.168.200.130:9200'
  ]
});

async function searchDocuments() {
  dsl = {
    "query": {
        "match": {
            "hobby": "⼲饭"
        }
    }
 }

  try {
    const result = await client.search({
      index: 'qzh_elk_nodejs_2024',
      body: dsl
    });

    console.error('result:', JSON.stringify(result));
  } finally {
    await client.close();
  }
}

searchDocuments();
