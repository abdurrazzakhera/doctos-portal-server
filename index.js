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
      const date = req.query.date;
      // console.log(date);

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

    // get perticular booking item user
    app.get("/booking", async (req, res) => {
      const patient = req.query.patient;
      const query = { patient: patient };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
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
