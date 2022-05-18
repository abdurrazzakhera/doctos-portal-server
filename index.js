const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

//midle were
app.use(cors());
app.use(express.json());

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

    //fien/get all data or services
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    //Available all services
    app.get("/avaiableService", async (req, res) => {
      const date = req.body.date || "May 18, 2022";

      //get all services
      const services = await serviceCollection.find().toArray();

      // step-2 : get the booking of the day
      const query = { date: date };
      const booking = await bookingCollection.find(query).toArray();

      //step-3 : for each service , find for booking servics
      services.forEach((service) => {
        const serviceBooking = booking.filter(
          (b) => b.treatment === service.name
        );
        const booked = serviceBooking.map((s) => s.slottime);
        const available = service.slots.filter((s) => !booked.includes(s));
        service.available = available;
        // service.booked = booked;
      });
      res.send(services);
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
