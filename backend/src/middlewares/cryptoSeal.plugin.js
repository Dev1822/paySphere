const crypto = require('crypto');

function generateHash(payload, previousHash) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(payload));
  if (previousHash) {
    hash.update(previousHash);
  }
  return hash.digest('hex');
}

function extractPayload(doc) {
  const obj = doc.toObject();
  delete obj.cryptoSeals;
  delete obj.updatedAt;
  delete obj.__v;
  // Sort keys to ensure consistent serialization order
  const sortedObj = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sortedObj[key] = obj[key];
    });
  return sortedObj;
}

/**
 * Mongoose plugin to append a cryptographic seal to a document on save,
 * forming an immutable chain of document history.
 */
function cryptoSealPlugin(schema) {
  schema.add({
    cryptoSeals: [
      {
        hash: { type: String, required: true },
        previousHash: { type: String },
        payloadSnapshot: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  });

  schema.pre('save', function (next) {
    // Only add a new seal if the document has been modified
    if (!this.isNew && !this.isModified()) {
      return next();
    }

    try {
      const payload = extractPayload(this);
      const payloadSnapshot = JSON.stringify(payload);

      let previousHash = null;
      if (this.cryptoSeals && this.cryptoSeals.length > 0) {
        previousHash = this.cryptoSeals[this.cryptoSeals.length - 1].hash;
      } else {
        previousHash = 'GENESIS';
      }

      const hash = generateHash(payload, previousHash);

      this.cryptoSeals.push({
        hash,
        previousHash,
        payloadSnapshot,
        timestamp: new Date(),
      });

      next();
    } catch (err) {
      next(err);
    }
  });

  // Note: For complete immutability guarantees, operations like updateOne,
  // updateMany, and findOneAndUpdate should ideally be restricted or hooked.
  // We'll add basic guards to throw errors if someone tries to bypass .save()
  // for these critical models.

  const preventBypass = function (next) {
    next(
      new Error(
        `Direct updates bypass cryptographic sealing. Use .save() for models with cryptoSealPlugin.`,
      ),
    );
  };

  schema.pre('updateOne', preventBypass);
  schema.pre('updateMany', preventBypass);
  schema.pre('findOneAndUpdate', preventBypass);
  schema.pre('update', preventBypass);
}

module.exports = cryptoSealPlugin;
