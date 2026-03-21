export default function handler(request, response) {
  response.status(200).json({
    message: 'Hello from PokeRogue API!',
    method: request.method,
    url: request.url
  });
}
