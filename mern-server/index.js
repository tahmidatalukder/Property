// index.js

require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- MongoDB Configuration ---
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});
const JWT_SECRET = process.env.JWT_SECRET;

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
            cb(null, true);
        } else {
            cb(new Error('Only .jpg or .jpeg files are allowed'), false);
        }
    }
});

// --- JWT Verification Middleware ---
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).send({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(403).send({ message: 'Malformed token.' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(500).send({ message: 'Failed to authenticate token.' });
        req.userId = decoded.id;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const database = client.db("PropertyInventory");
        const propertyCollection = database.collection("property");
        const userCollection = database.collection("users");
        
        console.log("Successfully connected to MongoDB!");

        // --- Authentication Routes ---
        app.post('/api/signup', async (req, res) => {
            const { name, phone, email, password } = req.body;
            const hashedPassword = await bcrypt.hash(password, 10);
            try {
                await userCollection.insertOne({ 
                    name, 
                    phone, 
                    email, 
                    password: hashedPassword, 
                    purchasedProperties: [], 
                    shortlist: [],
                    reviews: [],
                    trustedBy: [],
                    goldenBadges: [] 
                });
                res.status(201).send({ message: "User created successfully!" });
            } catch (error) {
                res.status(500).send({ message: "Error creating user", error });
            }
        });

        app.post('/api/login', async (req, res) => {
            const { email, password } = req.body;
            const user = await userCollection.findOne({ email });
            if (!user) {
                return res.status(404).send({ message: "User not found." });
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).send({ accessToken: null, message: "Invalid Password!" });
            }
            const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: 86400 }); // 24 hours
            res.status(200).send({ accessToken: token });
        });
        
        app.post('/api/forgot-password', async (req, res) => {
            const { email, newPassword } = req.body;
            const user = await userCollection.findOne({ email });
            if (!user) {
                return res.status(404).send({ message: "User not found." });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await userCollection.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
            res.status(200).send({ message: "Password updated successfully." });
        });

        // --- User Profile Routes ---
        app.get('/api/profile', verifyToken, async (req, res) => {
            try {
                const user = await userCollection.findOne({ _id: new ObjectId(req.userId) }, { projection: { password: 0 } });
                if (!user) return res.status(404).send("User not found");
                
                if (user.purchasedProperties && user.purchasedProperties.length > 0) {
                    const purchasedIds = user.purchasedProperties.map(id => new ObjectId(id));
                    user.purchasedPropertiesDetails = await propertyCollection.find({ _id: { $in: purchasedIds } }).toArray();
                } else {
                    user.purchasedPropertiesDetails = [];
                }
                res.status(200).json(user);
            } catch (error) {
                res.status(500).send({ message: "Error fetching profile", error });
            }
        });

        app.patch('/api/profile', verifyToken, async (req, res) => {
            const { name, phone } = req.body;
            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(req.userId) },
                    { $set: { name, phone } }
                );
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ message: "Error updating profile", error });
            }
        });

        // --- Seller Profile Routes ---
        app.get('/api/seller/:id', verifyToken, async (req, res) => {
            try {
                const seller = await userCollection.findOne(
                    { _id: new ObjectId(req.params.id) },
                    { projection: { password: 0, purchasedProperties: 0, shortlist: 0 } }
                );
                if (!seller) return res.status(404).send({ message: "Seller not found" });

                // Add counts to the response
                seller.trustCount = seller.trustedBy ? seller.trustedBy.length : 0;
                seller.goldenBadgeCount = seller.goldenBadges ? seller.goldenBadges.length : 0;
                
                res.status(200).json(seller);
            } catch (error) {
                res.status(500).send({ message: "Error fetching seller profile", error });
            }
        });

        app.post('/api/seller/:id/review', verifyToken, async (req, res) => {
            const { reviewText } = req.body;
            const reviewer = await userCollection.findOne({ _id: new ObjectId(req.userId) });

            const review = {
                reviewerId: req.userId,
                reviewerName: reviewer.name,
                text: reviewText,
                date: new Date()
            };

            await userCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $push: { reviews: review } }
            );
            res.status(200).send({ message: "Review added successfully" });
        });

        app.post('/api/seller/:id/trust', verifyToken, async (req, res) => {
            await userCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $addToSet: { trustedBy: new ObjectId(req.userId) } }
            );
            res.status(200).send({ message: "Seller marked as trusted" });
        });

        app.post('/api/seller/:id/golden-badge', verifyToken, async (req, res) => {
             await userCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $addToSet: { goldenBadges: new ObjectId(req.userId) } }
            );
            res.status(200).send({ message: "Golden badge given" });
        });


        // --- Property Routes ---
        app.post("/upload-property", verifyToken, upload.single('image'), async (req, res) => {
            if (!req.file) return res.status(400).send("No image file uploaded.");
            
            const data = req.body;
            const price = parseFloat(data.price) || 0;
            const vatRate = parseFloat(data.vatRate) || 0;
            const previousPrice = parseFloat(data.previousPrice) || 0;
            const priceWithVat = price + (price * (vatRate / 100));
            const priceChange = price - previousPrice;
            const incrementDecrementText = priceChange >= 0 ? `${priceChange.toFixed(2)} (Increment)` : `${Math.abs(priceChange).toFixed(2)} (Decrement)`;

            const propertyData = {
                ...data,
                price,
                vatRate,
                previousPrice,
                priceWithVat: priceWithVat.toFixed(2),
                priceChange: incrementDecrementText,
                image: req.file.path,
                ownerId: new ObjectId(req.userId),
                status: 'available', // 'available', 'pending', or 'sold'
                bids: [], 
            };
            
            const result = await propertyCollection.insertOne(propertyData);
            res.send(result);
        });

        app.get("/all-property", async (req, res) => {
            let query = { status: { $in: ['available', 'pending'] } };
            
            if (req.query.type) query.type = { $regex: req.query.type, $options: 'i' };
            if (req.query.location) query.location = { $regex: req.query.location, $options: 'i' };
            if (req.query.purpose) query.purpose = { $regex: req.query.purpose, $options: 'i' };

            const result = await propertyCollection.find(query).toArray();
            res.send(result);
        });
        
        app.get("/property/:id", verifyToken, async (req, res) => {
            const property = await propertyCollection.findOne({_id: new ObjectId(req.params.id)});
            res.send(property);
        });

        // --- Bidding Routes ---
        app.post('/api/property/:id/bid', verifyToken, async (req, res) => {
            const { price } = req.body;
            const user = await userCollection.findOne({ _id: new ObjectId(req.userId) });
            
            const bid = {
                userId: req.userId,
                userName: user.name,
                price: parseFloat(price),
                date: new Date()
            };

            await propertyCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $push: { bids: bid } }
            );
            res.status(200).send({ message: "Bid placed successfully" });
        });

        app.post('/api/property/:id/accept-bid', verifyToken, async (req, res) => {
            const { bidUserId, bidPrice } = req.body;
            const property = await propertyCollection.findOne({ _id: new ObjectId(req.params.id) });

            if (property.ownerId.toString() !== req.userId) {
                return res.status(403).send({ message: "You are not the owner of this property." });
            }

            await propertyCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { 
                    winningBidder: new ObjectId(bidUserId),
                    winningPrice: parseFloat(bidPrice),
                    status: 'pending' // Property is now pending payment
                } }
            );
            res.status(200).send({ message: "Bid accepted." });
        });

        // --- Shortlist & Payment Routes ---
        app.post('/api/shortlist/:propertyId', verifyToken, async (req, res) => {
            await userCollection.updateOne(
                { _id: new ObjectId(req.userId) },
                { $addToSet: { shortlist: new ObjectId(req.params.propertyId) } }
            );
            res.status(200).send({ message: "Added to shortlist." });
        });
        
        app.get('/api/shortlist', verifyToken, async (req, res) => {
            const user = await userCollection.findOne({ _id: new ObjectId(req.userId) });
            if (user && user.shortlist) {
                const shortlistedProperties = await propertyCollection.find({
                    _id: { $in: user.shortlist },
                    status: 'available'
                }).toArray();
                res.send(shortlistedProperties);
            } else {
                res.send([]);
            }
        });

        app.post('/api/purchase/:propertyId', verifyToken, async (req, res) => {
            const propertyId = new ObjectId(req.params.propertyId);
            const userId = new ObjectId(req.userId);

            await propertyCollection.updateOne(
                { _id: propertyId },
                { $set: { status: 'sold', buyerId: userId } }
            );

            await userCollection.updateOne(
                { _id: userId },
                { $push: { purchasedProperties: propertyId } }
            );

            await userCollection.updateMany({}, { $pull: { shortlist: propertyId } });
            
            res.status(200).send({ message: "Purchase successful!" });
        });

        app.get('/', (req, res) => res.send('Property Server is Running!'));

    } finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

