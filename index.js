const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

//midle were
app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

//mongodb uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wbtgx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//mongo db node crud operation
async function run() {
  try {
    await client.connect();
    const serviceCollection = client
      .db("doctors-portal")
      .collection("services");
    const bookingCollection = client.db("doctors-portal").collection("booking");
    const userCollection = client.db("doctors-portal").collection("user");
    const doctorCollection = client.db("doctors-portal").collection("doctor");
    const paymentCollection = client
      .db("doctors-portal")
      .collection("payments");

    const varifyAdmin = async (req, res, next) => {
      const requster = req.decoded.email;
      const requsterAccount = await userCollection.findOne({ email: requster });
      if (requsterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    //Paymet Intent method
    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //fien/get all data or services
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });
    //Make admin all user
    app.put("/user/admin/:email", verifyJWT, varifyAdmin, async (req, res) => {
      const email = req.params.email;

      //Crate a filter to user update
      const filter = { email: email };
      console.log(filter);
      // create a document that sets the plot of the movie
      const updateDoc = {
        $set: { role: "admin" },
      };
      // update a user set database
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //Put All user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      //Crate a filter to user update
      const filter = { email: email };
      //this option instruc the method to create a document if no document match
      const options = { upsert: true };
      // create a document that sets the plot of the movie
      const updateDoc = {
        $set: user,
      };
      // update a user set database
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    //Available all services
    app.get("/avaiableService", async (req, res) => {
      const date = req.query.date;
      // get all services
      const services = await serviceCollection.find().toArray();
      // step-2 : get the booking of the day
      const query = { date: date };
      const booking = await bookingCollection.find(query).toArray();
      //step-3 : for each service
      services.forEach((service) => {
        //step-4:find for that booking services
        const serviceBooking = booking.filter(
          (book) => book.treatment === service.name
        );
        //step-5:select slots for the service booking:
        const bookedSlots = serviceBooking.map((book) => book.slottime);
        // step-6 select those slot that are not bookedSlots
        const availAble = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = availAble;
      });
      res.send(services);
    });

    //Get All User methodd
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get admin user
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // get perticular booking item user
    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      // const decodedEmail = req.decoded.email;
      // console.log(decodedEmail);
      if (patient === req.decoded?.email) {
        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);
      } else {
        res.status(403).send({ massage: "Forbiden Access" });
      }
      // const authorization = req.headers.authorization;
      // console.log(authorization);
    });

    //Booking a insert a date
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });

    // Get Booking by id
    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    //Update Payment true
    app.patch("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transectionId: payment.transectionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await bookingCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(updatedBooking);
    });

    //get all doctor data
    app.get("/doctor", verifyJWT, varifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });

    //ALL Doctor added in  a post method;
    app.post("/doctor", verifyJWT, varifyAdmin, async (req, res) => {
      const doctor = req.body;
      const resutl = await doctorCollection.insertOne(doctor);
      res.send(resutl);
    });
    //delete a doctor
    app.delete("/doctor/:email", verifyJWT, varifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const resutl = await doctorCollection.deleteOne(query);
      res.send(resutl);
    });
  } finally {
  }
}

// calll the mongo db function
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello Doctors Portal");
});

app.listen(port, () => {
  console.log(`Doctor Portal server is running  ${port}`);
});
