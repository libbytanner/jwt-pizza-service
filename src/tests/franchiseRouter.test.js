const request = require("supertest");
const app = require("../service");
const { DB, Role } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testUserId;
let testFranchise = { name: "franchise test", admins: [testUser] };
let admin = {
  name: "admin",
  email: "test@admin.com",
  password: "admin",
  roles: [{ role: Role.Admin }],
};

let secondFranchise = { name: "second franchise", admins: [admin] };


beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;

  await createAdminUser(admin);
  testFranchise = await createFranchise(testFranchise);
  secondFranchise = await createFranchise(secondFranchise);
});

async function createFranchise(franchise) {
  return await DB.createFranchise(franchise);
}

async function createAdminUser(admin) {
  await DB.addUser(admin);
}

test("get franchises", async () => {
  const getFranchisesRes = await request(app)
    .get(`/api/franchise?page=0&limit=10&name=*`)
    .send();
  expect(getFranchisesRes.body.franchises.length).toBe(2);
});

test("get user franchises", async () => {
  const getUserFranchisesRes = await request(app)
    .get(`/api/franchise/${testUserId}`)
    .set(`Authorization`, `Bearer ${testUserAuthToken}`)
    .send();
  expect(getUserFranchisesRes.body.length).toBe(1);
});

test("get user franchises bad user", async () => {
  const getUserFranchisesRes = await request(app)
    .get(`/api/franchise/BADUSER`)
    .set(`Authorization`, `Bearer ${testUserAuthToken}`)
    .send();
  expect(getUserFranchisesRes.body.message).toBe("unauthorized");
});

test("create franchise", async () => {
  const loginRes = await request(app).put("/api/auth").send(admin);
  const adminAuthToken = loginRes.body.token;
  const newFranchise = {
    name: "new franchise",
    admins: [{ email: `${testUser.email}` }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(newFranchise);
  expect(createFranchiseRes.status).toBe(200);
});

test('create franchise not admin', async () => {
  const newFranchise = {
    name: "new franchise",
    admins: [{ email: `${testUser.email}` }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(newFranchise);
  expect(createFranchiseRes.status).toBe(403);
});

test('delete franchise', async () => {
  let getFranchisesRes = await request(app)
    .get(`/api/franchise?page=0&limit=10&name=*`)
    .send();
  const currentLength = getFranchisesRes.body.franchises.length;
  const deleteRes = await request(app).delete(`/api/franchise/${secondFranchise.id}`);
  expect(deleteRes.status).toBe(200);

  getFranchisesRes = await request(app)
  .get(`/api/franchise?page=0&limit=10&name=*`)
  .send();

  const newLength = getFranchisesRes.body.franchises.length;
  expect(newLength).toBe((currentLength - 1))
})

test('create store', async () => {
  const testStore = {franchiseId: testFranchise.id, name:"TEST STORE"}
  const createRes = await request(app).post(`/api/franchise/${testFranchise.id}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send(testStore);
  expect(createRes.body.name).toBe(testStore.name)
})