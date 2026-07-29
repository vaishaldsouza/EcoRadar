/**
 * data.js
 * -----------------------------------------------------------------------
 * No MongoDB, no ORM. Just three plain in-memory arrays acting as our
 * entire "database". Every record is looked up, inserted, and searched
 * via array indices/pointers — never a Map or Set.
 * -----------------------------------------------------------------------
 */

const users = [];    // { id, name, email, passwordHash, points, createdAt }
const issues = [];   // { id, userId, title, category, severity, lat, lng, status, upvotes, createdAt }
const messages = []; // { id, issueId, senderId, text, createdAt }

let nextUserId = 1;
let nextIssueId = 1;
let nextMessageId = 1;

// Linear-scan lookups (array + pointer, no hashmap)
function findUserByEmail(email) {
  for (let i = 0; i < users.length; i++) {
    if (users[i].email === email) return users[i];
  }
  return null;
}

function findUserById(id) {
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === id) return users[i];
  }
  return null;
}

function findIssueById(id) {
  for (let i = 0; i < issues.length; i++) {
    if (issues[i].id === id) return issues[i];
  }
  return null;
}

module.exports = {
  users,
  issues,
  messages,
  findUserByEmail,
  findUserById,
  findIssueById,
  nextIds: {
    user: () => nextUserId++,
    issue: () => nextIssueId++,
    message: () => nextMessageId++,
  },
};
