const request = require("supertest");
const mongoose = require("mongoose");
const { Rental } = require("../../models/rental");
const { User } = require("../../models/user");
const { Movie } = require("../../models/movie");
const moment = require("moment");
let server;

describe("/api/returns", () => {
  let rental;
  let movieId;
  let customerId;
  let token;
  let movie;

  const exec = () => {
    return request(server)
      .post("/api/returns")
      .set("x-auth-token", token)
      .send({
        customerId,
        movieId
      });
  };

  beforeEach(async () => {
    server = require("../../index");
    token = new User().generateAuthToken();
    (customerId = mongoose.Types.ObjectId()),
      (movieId = mongoose.Types.ObjectId()),
      (movie = new Movie({
        _id: movieId,
        title: "12345",
        dailyRentalRate: 2,
        genre: {
          name: "12345"
        },
        numberInStock: 10
      }));

    await movie.save();

    rental = new Rental({
      customer: {
        _id: customerId,
        name: "12345",
        phone: "12345"
      },
      movie: {
        _id: movieId,
        title: "12345",
        dailyRentalRate: 2
      }
    });
    await rental.save();
  });
  afterEach(async () => {
    await Rental.deleteMany({});
    await Movie.deleteMany({});
    server.close();
  });
  it("should return 401 if the user is not logged in ", async () => {
    const res = await request(server)
      .post("/api/returns")
      .send({
        customerId,
        movieId
      });
    expect(res.status).toBe(401);
  });
  it("should retuen 400 if the customer id is not provided", async () => {
    customerId = "";

    const res = await exec();
    expect(res.status).toBe(400);
  });
  it("should return 400 if the movie id is not provided ", async () => {
    movieId = "";

    const res = await exec();

    expect(res.status).toBe(400);
  });
  it("should return 404 if no rental foud for this customer/ movie", async () => {
    await Rental.deleteMany({});

    const res = await exec();

    expect(res.status).toBe(404);
  });
  it("should return 400 if the rental had been already processed", async () => {
    rental.dateReturned = Date.now();
    await rental.save();
    const res = await exec();

    expect(res.status).toBe(400);
  });
  it("should return 200 if valid request", async () => {
    const res = await exec();

    expect(res.status).toBe(200);
  });
  it("should set the return date ", async () => {
    const res = await exec();
    const rentalInDb = await Rental.findById(rental._id);
    const diff = new Date() - rentalInDb.dateReturned;

    expect(diff).toBeLessThan(10 * 1000);
  });
  it("calculate the rental fee ", async () => {
    rental.dateOut = moment()
      .add(-7, "days")
      .toDate();
    await rental.save();

    const res = await exec();

    const rentalInDb = await Rental.findById(rental._id);
    expect(rentalInDb.rentalFee).toBe(14);
  });
  it("should increase the  movie number in stock ", async () => {
    const res = await exec();

    const movieInDb = await Movie.findById(movieId);

    expect(movieInDb.numberInStock).toBe(movie.numberInStock + 1);
  });
  it("should return the renal object", async () => {
    const res = await exec();
    rental.save();
    const rentalInDb = await Rental.findById(rental._id);

    expect(Object.keys(res.body)).toEqual(
      expect.arrayContaining([
        "dateOut",
        "dateReturned",
        "rentalFee",
        "customer",
        "movie"
      ])
    );
  });
});
