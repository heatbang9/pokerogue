export default function handler(req: any, res: any) {
  res.status(200).json({ 
    message: 'PokeRogue API is working!',
    timestamp: new Date().toISOString()
  });
}
