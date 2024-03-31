const { Client } = require('@elastic/elasticsearch');

const client = new Client({
  nodes: [
    'http://192.168.200.128:9200',
    'http://192.168.200.129:9200',
    'http://192.168.200.130:9200'
  ]
});

async function createIndex() {
  try {
    const { body: exists } = await client.indices.exists({
      index: 'qzh_elk_nodejs_2024'
    });

    if (exists) {
      console.log('Index already exists.');
      return;
    }

    const { body: result } = await client.indices.create({
      index: 'qzh_elk_nodejs_2024',
      body: {
        settings: {
          index: {
            number_of_replicas: '2',
            number_of_shards: '5'
          }
        },
        mappings: {
          properties: {
            ip_addr: { type: 'ip' },
            name: { type: 'text' },
            id: { type: 'long' },
            hobby: { type: 'text' },
            email: { type: 'keyword' }
          }
        },
        aliases: {
          'qzh_elk_nodejs_2024_aliase01': {},
          'qzh_elk_nodejs_2024_aliase02': {}
        }
      }
    });

    console.log(result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

createIndex();
