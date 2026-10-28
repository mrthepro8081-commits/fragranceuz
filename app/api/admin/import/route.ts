import {importEndpoint} from '../../../../lib/import-endpoint';
export const dynamic='force-dynamic';
export async function POST(request:Request){return importEndpoint(request)}
