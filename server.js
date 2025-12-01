const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ensure directories exist
const ensureDirectories = () => {
  const dirs = ['uploads', 'data'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectories();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'image') {
      const allowed = /jpeg|jpg|png|gif|bmp|webp/;
      const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
                 allowed.test(file.mimetype);
      return cb(null, ok);
    }
    if (file.fieldname === 'audio') {
      const allowed = /mpeg|mp3|wav|ogg/;
      const ok = allowed.test(file.mimetype);
      return cb(null, ok);
    }
    cb(null, false);
  }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]);

const uploadAudio = multer({ storage: storage }).single('audio');

// Data structure
let database = {
  images: {},
  links: []
};

// Load database
function loadDatabase() {
  try {
    if (fs.existsSync('data/database.json')) {
      const data = fs.readFileSync('data/database.json', 'utf8');
      database = JSON.parse(data);
      console.log('✅ Database loaded');
    }
  } catch (error) {
    console.log('📝 No existing database, starting fresh');
  }
}

// Save database
function saveDatabase() {
  try {
    fs.writeFileSync('data/database.json', JSON.stringify(database, null, 2));
    console.log('💾 Database saved');
  } catch (error) {
    console.error('❌ Error saving database:', error);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload image + optional audio
// ЗАМЕНИ ВЕСЬ ЭТОТ БЛОК (от app.post('/api/upload' до закрывающей }); )
app.post('/api/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message });
    }

    try {
      // Проверяем, что есть изображение
      if (!req.files || !req.files.image || !req.files.image[0]) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const imageFile = req.files.image[0];
      const audioFile = req.files.audio ? req.files.audio[0] : null;

      // ВАЖНО: создаём ID СНАЧАЛА!
      const imageId = uuidv4();

      const imageInfo = {
        id: imageId,
        filename: imageFile.filename,
        originalName: imageFile.originalname,
        path: `/uploads/${imageFile.filename}`,
        audio: audioFile ? `/uploads/${audioFile.filename}` : null,
        audioName: audioFile ? audioFile.originalname : null,
        uploadDate: new Date().toISOString(),
        regions: [],
        description: req.body.description || '',
        size: imageFile.size,
        mimetype: imageFile.mimetype
      };

      database.images[imageId] = imageInfo;
      saveDatabase();

      console.log('Image uploaded:', imageInfo.originalName);
      if (audioFile) console.log('Audio attached:', audioFile.originalname);

      res.json({ success: true, image: imageInfo });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});
// Загрузить/изменить аудио для изображения
// Загрузить/изменить аудио для изображения
app.post('/api/images/:id/audio', uploadAudio, (req, res) => {
  const imageId = req.params.id;
  const image = database.images[imageId];
  if (!image) return res.status(404).json({ error: 'Image not found' });

  // Удаляем старый аудиофайл, если был
  if (image.audio) {
    const oldPath = path.join(__dirname, 'uploads', path.basename(image.audio));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  if (req.file) {
    image.audio = `/uploads/${req.file.filename}`;
    image.audioName = req.file.originalname;
  } else {
    image.audio = null;
    image.audioName = null;
  }

  saveDatabase();
  res.json({ success: true, audio: image.audio });
});

// Get all images
app.get('/api/images', (req, res) => {
  res.json(database.images);
});

// Get specific image
app.get('/api/images/:id', (req, res) => {
  const image = database.images[req.params.id];
  if (image) {
    res.json(image);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// В методе добавления региона замените:
app.post('/api/images/:id/regions', (req, res) => {
    const imageId = req.params.id;
    const region = req.body;
    
    if (!database.images[imageId]) {
        return res.status(404).json({ error: 'Image not found' });
    }

    // Ensure region has ID
    if (!region.id) {
        region.id = 'roi_' + uuidv4();
    }

    // Ensure we have relative coordinates
    if (typeof region.relativeX === 'undefined') {
        // If we have absolute coordinates but no relative, calculate them
        // This handles migration from old data
        region.relativeX = region.x / 1000; // Example conversion
        region.relativeY = region.y / 1000;
        region.relativeWidth = region.width / 1000;
        region.relativeHeight = region.height / 1000;
    }

    region.createdAt = new Date().toISOString();
    
    // Remove existing region with same ID
    database.images[imageId].regions = database.images[imageId].regions.filter(r => r.id !== region.id);
    
    // Add new region
    database.images[imageId].regions.push(region);
    saveDatabase();

    console.log('✅ Region saved:', region.name);

    res.json({ success: true, region });
});

// Delete region
app.delete('/api/images/:imageId/regions/:regionId', (req, res) => {
  const { imageId, regionId } = req.params;
  
  if (!database.images[imageId]) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // Remove region
  database.images[imageId].regions = database.images[imageId].regions.filter(r => r.id !== regionId);
  
  // Remove links associated with this region
  database.links = database.links.filter(link => 
    !(link.sourceImageId === imageId && link.sourceRegionId === regionId) &&
    !(link.targetImageId === imageId && link.targetRegionId === regionId)
  );

  saveDatabase();

  res.json({ success: true });
});

// Create link
app.post('/api/links', (req, res) => {
  const link = req.body;
  
  if (!link.sourceImageId || !link.targetImageId || !link.sourceRegionId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if images exist
  if (!database.images[link.sourceImageId] || !database.images[link.targetImageId]) {
    return res.status(404).json({ error: 'Source or target image not found' });
  }

  // Check if source region exists
  const sourceImage = database.images[link.sourceImageId];
  const sourceRegionExists = sourceImage.regions.some(r => r.id === link.sourceRegionId);
  if (!sourceRegionExists) {
    return res.status(404).json({ error: 'Source region not found' });
  }

  // Generate link ID
  link.id = 'link_' + uuidv4();
  link.createdAt = new Date().toISOString();
  
  // Remove existing link with same source
  database.links = database.links.filter(l => 
    !(l.sourceImageId === link.sourceImageId && l.sourceRegionId === link.sourceRegionId)
  );
  
  // Add new link
  database.links.push(link);
  saveDatabase();

  console.log('✅ Link created:', link.id);

  res.json({ success: true, link });
});

// Get links for image
app.get('/api/images/:id/links', (req, res) => {
  const imageId = req.params.id;
  
  // Find all links where this image is either source or target
  const imageLinks = database.links.filter(link => 
    link.sourceImageId === imageId || link.targetImageId === imageId
  );

  console.log(`🔗 Returning ${imageLinks.length} links for image ${imageId}`);

  res.json(imageLinks);
});

// Get outgoing links from region
app.get('/api/images/:imageId/regions/:regionId/links', (req, res) => {
  const { imageId, regionId } = req.params;
  
  const outgoingLinks = database.links.filter(link => 
    link.sourceImageId === imageId && link.sourceRegionId === regionId
  );

  console.log(`🔗 Returning ${outgoingLinks.length} outgoing links from region ${regionId}`);

  res.json(outgoingLinks);
});

// Delete link
app.delete('/api/links/:linkId', (req, res) => {
  const linkId = req.params.linkId;
  
  const initialLength = database.links.length;
  database.links = database.links.filter(link => link.id !== linkId);
  
  if (database.links.length < initialLength) {
    saveDatabase();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Link not found' });
  }
});

// Delete image
app.delete('/api/images/:id', (req, res) => {
  const imageId = req.params.id;
  
  if (!database.images[imageId]) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // Remove image file
  const image = database.images[imageId];
  const filePath = path.join(__dirname, 'uploads', image.filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('🗑️ Deleted image file:', image.filename);
  }

  // Remove image and associated links/regions
  delete database.images[imageId];
  database.links = database.links.filter(link => 
    link.sourceImageId !== imageId && link.targetImageId !== imageId
  );

  saveDatabase();

  console.log('🗑️ Deleted image from database:', imageId);

  res.json({ success: true });
});

// Initialize and start server
loadDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Text2World server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`💾 Database: ${path.join(__dirname, 'data', 'database.json')}`);
});