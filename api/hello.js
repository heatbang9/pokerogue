module.exports = (req, res) => {
  res.status(200).json({ 
    message: 'PokeRogue API is working!',
    timestamp: new Date().toISOString()
  });
};
