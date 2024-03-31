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
    const { body: result } = await client.search({
      index: 'qzh_elk_nodejs_2024'
    });

    if (!result || !result.hits || !result.hits.hits) {
      console.error('Invalid search result:', result);
      return;
    }


    console.log('Search result:', result);
    console.log('Hits:', result.hits);
    console.log('Hits array:', result.hits.hits);
    console.log('First hit source:', result.hits.hits[0]._source);
    console.log('First hit name:', result.hits.hits[0]._source.name);
    console.log('First hit hobby:', result.hits.hits[0]._source.hobby);
  } catch (error) {
    console.error('Error during search:', error);
  } finally {
    await client.close();
  }
}

searchDocuments();
