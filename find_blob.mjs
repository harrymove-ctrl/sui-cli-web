import { SuiGrpcClient } from '@mysten/sui/grpc';
const client = new SuiGrpcClient({ network: 'testnet', baseUrl: 'https://fullnode.testnet.sui.io:443' });
const owner = '0x994845a200c22d021eb08f97136a43fb04ea93fe27b1efbf8fd95f8a3034757b';

let pageToken;
const blobs = [];
for (let page = 0; page < 5 && blobs.length < 3; page++) {
  const { response } = await client.liveDataService.listOwnedObjects({
    owner,
    pageSize: 200,
    pageToken,
    readMask: { paths: ['object_id', 'object_type'] },
  });
  for (const o of response.objects) {
    if (o.objectType && o.objectType.toLowerCase().includes('::blob::blob')) {
      blobs.push({ id: o.objectId, type: o.objectType });
    }
  }
  pageToken = response.nextPageToken;
  if (!pageToken || pageToken.length === 0) break;
}
console.log(JSON.stringify(blobs, null, 2));
