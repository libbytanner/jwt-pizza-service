const request = require("supertest");
const app = require("../service");
const { DB, Role } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testFranchise = { name: "test franchise", admins: [testUser] };
let admin = {
  name: "admin",
  email: "test@admin.com",
  password: "admin",
  roles: [{ role: Role.Admin }],
};

let testMenuItem = {
  title: "Student",
  description: "No topping, no sauce, just carbs",
  image: "pizza9.png",
  price: 0.0001,
  menuId: 0
};

let testStore = {
  franchiseId: 0,
  name: "Test Store",  
}

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}


beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;

  testFranchise = await createFranchise(testFranchise);
  testStore.franchiseId = testFranchise.id
  await createAdminUser(admin);
  testMenuItem = await createMenuItem(testMenuItem);
  testMenuItem.menuId = testMenuItem.id
  testStore = await createStore(testStore)
});

async function createFranchise(franchise) {
  return await DB.createFranchise(franchise);
}

async function createAdminUser(admin) {
  await DB.addUser(admin);
}

async function createMenuItem(menuItem) {
  return await DB.addMenuItem(menuItem);
}

async function createStore(store) {
  return await DB.createStore(store.franchiseId, store)
}

test("get menu", async () => {
  const getMenuRes = await request(app).get("/api/order/menu").send();
  expect(getMenuRes.body.length).toBe((1));
});

test('add menu item', async () => {
    const testItem = {
        title: "TEST PIZZA",
        description: "the best pizza ever",
        image: "pizza9.png",
        price: 0.01,
      };
      const loginRes = await request(app).put("/api/auth").send(admin);
      const adminAuthToken = loginRes.body.token;
    
    const addRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminAuthToken}`).send(testItem);
    expect(addRes.status).toBe(200);

    const getMenuRes = await request(app).get("/api/order/menu").send();
    expect(getMenuRes.body.length).toBe((2));
})

test('add menu item not admin', async () => {
  const testItem = {
    title: "TEST PIZZA",
    description: "the best pizza ever",
    image: "pizza9.png",
    price: 0.01,
  };
  const addRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send(testItem);
    expect(addRes.status).toBe(403)

})

test('create order', async () => {
  const testOrder = {franchiseId: testFranchise.id, storeId: testStore.id, items: [testMenuItem]}
  const createRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send(testOrder)
  expect(createRes.status).toBe(200);
  const getRes = await request(app).get('/api/order').set("Authorization", `Bearer ${testUserAuthToken}`).send();
  expect(getRes.body.orders.length).toBe(1)
})