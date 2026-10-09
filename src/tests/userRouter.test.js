const request = require("supertest");
const app = require("../service");
const { DB, Role } = require("../database/database.js");


const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

let admin = {
  name: "admin",
  email: "test@admin.com",
  password: "admin",
  roles: [{ role: Role.Admin }],
};


beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;

  await createAdminUser(admin);
});

async function createAdminUser(admin) {
  await DB.addUser(admin);
}

test("get user", async () => {
  const getUserResult = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(getUserResult.body.email).toBe(testUser.email);
});

test("update user positive", async () => {
  const userResponse = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  const updatedUser = {
    name: "new test",
    email: "new@test.com",
    password: "test",
  };
  const updateUserResult = await request(app)
    .put(`/api/user/${userResponse.body.id}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(updatedUser);
  expect(updateUserResult.body.user.name).toBe("new test");
});

test("update user negative", async () => {
  const updatedUser = {
    name: "new test",
    email: "new@test.com",
    password: "test",
  };
  const updateUserResult = await request(app)
    .put(`/api/user/BADID`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(updatedUser);

  expect(updateUserResult.body.message).toBe("unauthorized");
});

test("list users unauthorized", async () => {
  const listUsersRes = await request(app).get("/api/user/");
  expect(listUsersRes.status).toBe(401);
});

test("list users", async () => {
  const loginRes = await request(app).put("/api/auth").send(admin);
  const adminToken = loginRes.body.token;
  const listUsersRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + adminToken);
  expect(listUsersRes.status).toBe(200);
});

test("list users pagination", async () => {
  const loginRes = await request(app).put("/api/auth").send(admin);
  const adminToken = loginRes.body.token;
  const listUsersRes = await request(app)
    .get("/api/user?page=1&limit=1&name=*")
    .set("Authorization", "Bearer " + adminToken);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body.users.length).toBe(1);
});

test("list users filter", async () => {
  const uniqueUser = {name: 'Unique user', email: "email@email.com", password: 'a', roles: [Role.Diner]}
  await request(app).post("/api/auth").send(uniqueUser);
  const loginRes = await request(app).put("/api/auth").send(admin);
  const adminToken = loginRes.body.token;
  const listUsersRes = await request(app)
    .get("/api/user?name=Unique")
    .set("Authorization", "Bearer " + adminToken);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body.users.length).toBe(1);
});


// async function registerUser(service) {
//   const testUser = {
//     name: "pizza diner",
//     email: `${randomName()}@test.com`,
//     password: "a",
//   };
//   const registerRes = await service.post("/api/auth").send(testUser);
//   registerRes.body.user.password = testUser.password;

//   return [registerRes.body.user, registerRes.body.token];
// }

// function randomName() {
//   return Math.random().toString(36).substring(2, 12);
// }
