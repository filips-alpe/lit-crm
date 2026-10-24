import { stringify } from 'devalue';

/** A superforms `dataType: 'json'` POST, as the TypeForm client sends it. */
export function typeFormRequest(data: Record<string, unknown>): Request {
  const fd = new FormData();
  fd.set('__superform_json', stringify(data));
  return new Request('http://localhost/', { method: 'POST', body: fd });
}
