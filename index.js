const express = require('express')
const app = express()
const cors = require('cors')
const admin = require("firebase-admin");
const fileUpload = require('express-fileupload')
const { MongoClient, Admin } = require('mongodb');
const ObjectId = require('mongodb').ObjectId
const stripe = require('stripe')(process.env.STRIPE_SECRET)
require('dotenv').config()
const port = process.env.PORT || 5000
app.use(cors())
app.use(express.json())
app.use(fileUpload())
// doctors-portal-9d95c-firebase-adminsdk-eme8f-61353cbfd8.json

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// console.log(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wusl0.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1]
        try {
            const decodedUser = await admin.auth().verifyIdToken(token)
            req.decodedEmail = decodedUser.email
        }
        catch {

        }
    }

    next()
}
// console.log(uri)
async function run() {
    try {
        await client.connect()

        const database = client.db('doctors_portal')
        const appointmentCollection = database.collection('appointments')
        const usersCollection = database.collection('users')
        const doctorsCollection = database.collection('doctors')
        // console.log('database connect successfully')
        app.post('/appointments', async (req, res) => {
            const appointment = req.body
            console.log(req.body)
            const result = await appointmentCollection.insertOne(appointment)
            // console.log(appointments)
            res.json(result)
        })

        // get appointments
        app.get('/appointments', async (req, res) => {
            const email = req.query.email
            const date = req.query.date
            // console.log(date)
            const query = { email: email, date: date }
            const cursor = appointmentCollection.find(query)
            const appointments = await cursor.toArray()
            res.json(appointments)
        })

        app.get('/appointments/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await appointmentCollection.findOne(query)
            res.json(result)
        })


        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    payment: payment
                }
            }
            const result = await appointmentCollection.updateOne(filter, updateDoc)
            res.json(result)
        })

        // admin cheking
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let isAdmin = false
            if (user?.role === 'admin') {
                isAdmin = true
            }
            res.json({ admin: isAdmin })
        })

        app.post('/doctors', async (req, res) => {
            const name = req.body.name
            const email = req.body.email
            const pic = req.files.image
            const picData = pic.data
            const enCodedPic = picData.toString('base64')
            const imageBuffer = Buffer.from(enCodedPic, 'base64')
            const doctor = {
                name,
                email,
                image: imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor)
            res.json(result)
        })

        app.get('/doctors', async (req, res) => {
            const cursor = doctorsCollection.find({})
            const doctors = await cursor.toArray()
            res.json(doctors)
        })
        // sae data from users
        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.json(result)
            console.log(result)
        })
        // upsert
        app.put('/users', async (req, res) => {
            const user = req.body
            const filter = { email: user.email }
            const options = { upsert: true };
            const updateDoc = { $set: user }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.json(result)
        });
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body
            console.log('put', req.decodedEmail)
            const filter = { email: user.email }
            const updateDoc = { $set: { role: 'admin' } }
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.json(result)
        });
        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });



    }
    finally {
        // await client.close();
    }

}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello doctors portal!')
})

app.listen(port, () => {
    console.log(` listening at ${port}`)
})