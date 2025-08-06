const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')

//middleware
app.use(cors());
app.use(express.json());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


//mT9SpHaL7IZu878P


app.get('/', (req, res) => {
    res.send('Hello World!')
})

//mongodb configuration


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://mproperty:mT9SpHaL7IZu878P@cluster0.jkizvhl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //create a collections of documents
    const propertyCollection = client.db("PropertyInventory").collection("property");

    //insert a new property to the database: post method
    app.post("/upload-property", async(req, res) => {
        const data = req.body;
        const result = await propertyCollection.insertOne(data);
        res.send(result);
    })

    // get all property data from database
   // app.get("/all-property", async(req, res) =>{
        //const property = propertyCollection.find()
        //const result = await property. toArray();
        //res.send(result);
    //})

    //update a property data: patch or update methods
    app.patch("/property/:id", async(req, res) =>{
        const id = req.params.id;
        //console.log(id);
        const updatepropertydata = req.body;
        const filter = {_id: new ObjectId(id)}
        const options = { upsert: true};

        const updateDoc = {
            $set: {
                ...updatepropertydata
            }
        }
        //update
        const result = await propertyCollection.updateOne(filter, updateDoc, options)
        res.send(result);
    })

    //delete a property data
    app.delete("/property/:id", async(req, res) =>{
        const id = req.params.id;
        const filter = { _id: new ObjectId(id)};
        const result = await propertyCollection.deleteOne(filter);
        res.send(result)
    })

    //find by type
    app.get("/all-property", async(req, res) =>{
        let query = {};
        if(req.query?.type){
            query = {type: req.query.type}
        }
        const result = await propertyCollection.find(query).toArray();
        res.send(result);
    })

    //find by purpose
    //app.get("/all-property", async(req, res) =>{
        //let query = {};
        //if(req.query?.purpose){
            //query = {purpose: req.query.purpose}
     //}
        //const result = await propertyCollection.find(query).toArray();
        //res.send(result);
    //})



    
    // get all property data from database with filters
    app.get("/all-property", async (req, res) => {
        const query = {};

        // Filter by type
        if (req.query?.type) {
             query.type = req.query.type;
        }

        // Filter by price range
        if (req.query?.minPrice && req.query?.maxPrice) {
            query.price = {
                $gte: parseFloat(req.query.minPrice),
                $lte: parseFloat(req.query.maxPrice)
            };
        }
    
    

        const result = await propertyCollection.find(query).toArray();
        res.send(result);
    });






    //image
    
    const multer = require('multer');
    const path = require('path');

    // Configure Multer for file upload
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/'); // Images will be saved in the 'uploads' folder
            // 
            },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + file.originalname);
        }
    });

    const upload = multer({ storage: storage });

    // Insert a new property with image upload
    app.post("/upload-property-with-image", upload.single('image'), async(req, res) => {
        const data = req.body;
        const imageUrl = req.file ? req.file.path : null;

        if (imageUrl) {
            data.image = imageUrl; // Add image URL to the property data
        }
    
        const result = await propertyCollection.insertOne(data);
        res.send(result);
    });






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);






app.listen(port,() =>{
    console.log(`Example app listening on port ${port}`)
})