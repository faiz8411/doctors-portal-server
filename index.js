const express = require('express')
const app = express()
const cors = require('cors')
const admin = require("firebase-admin");

const { MongoClient, Admin } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000
app.use(cors())
app.use(express.json())
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
            const date = new Date(req.query.date).toLocaleDateString()
            // console.log(date)
            const query = { email: email, date: date }
            const cursor = appointmentCollection.find(query)
            const appointments = await cursor.toArray()
            res.json(appointments)
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
        })


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