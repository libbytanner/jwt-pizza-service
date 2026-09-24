const request = require("supertest");
const app = require("../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
});

test("get user", async () => {
  const getUserResult = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
expect(getUserResult.body.email).toBe(testUser.email)
});

test('update user positive', async () => {
    const userResponse = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
    const updatedUser = {name: 'new test', email: 'new@test.com', password: 'test'};
    const updateUserResult = await request(app).put(`/api/user/${userResponse.body.id}`).set('Authorization', `Bearer ${testUserAuthToken}`).send(updatedUser)
    expect(updateUserResult.body.user.name).toBe('new test')
})

test('update user negative', async () => {
  const updatedUser = {name: 'new test', email: 'new@test.com', password: 'test'};
  const updateUserResult = await request(app).put(`/api/user/BADID`).set('Authorization', `Bearer ${testUserAuthToken}`).send(updatedUser)

  expect(updateUserResult.body.message).toBe('unauthorized')
})
