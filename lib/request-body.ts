export class RequestBodyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Bound bytes while reading, including chunked requests without Content-Length.
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes) {
    throw new RequestBodyError(413, 'Solicitud demasiado grande.');
  }
  if (!request.body) throw new RequestBodyError(400, 'Solicitud inválida.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError(413, 'Solicitud demasiado grande.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, 'Solicitud inválida.');
  } finally {
    reader.releaseLock();
  }
}
