const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const secretKey = process.env.JWT_SECRET;

/**
 * @name haversineDistance
 * @function
 * @memberof module:lib/leaseLibrary
 * @desc Calculate distance between two geographic coordinates in km or miles
 * @param {Array<Number>} coordinatesSet1
 * @param {Array<Number>} coordinatesSet2
 * @returns {Boolean}
 */

const haversineDistance = ([lat1, lon1], [lat2, lon2], isMiles = false) => {
  const toRadian = (angle) => (Math.PI / 180) * angle;
  const distance = (a, b) => (Math.PI / 180) * (a - b);
  const RADIUS_OF_EARTH_IN_KM = 6371;

  const dLat = distance(lat2, lat1);
  const dLon = distance(lon2, lon1);

  lat1 = toRadian(lat1);
  lat2 = toRadian(lat2);

  // Haversine Formula
  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.sqrt(a));

  let finalDistance = RADIUS_OF_EARTH_IN_KM * c;

  if (isMiles) {
    finalDistance /= 1.60934;
  }

  return Math.floor(finalDistance * 100) / 100;
};

/**
 * @name dateRangeOverlaps
 * @function
 * @memberof module:lib/leaseLibrary
 * @desc Checks if two date ranges objects overlaps: {startDate1, endDate1} vs {startDate2, endDate2}
 * @param {{startDate: Date, endDate: Date}} dateRange1 - first date range
 * @param {{startDate: Date, endDate: Date}}  dateRange2 - second date range
 * @returns {Boolean}
 */

const dateRangeOverlaps = (dateRange1, dateRange2) => {
  console.log(dateRange1, dateRange2);
  dateRange1.startDate = new Date(dateRange1.startDate).getTime();
  dateRange1.endDate = new Date(dateRange1.endDate).getTime();

  dateRange2.startDate = new Date(dateRange2.startDate).getTime();
  dateRange2.endDate = new Date(dateRange2.endDate).getTime();

  if (
    dateRange1.startDate <= dateRange2.startDate &&
    dateRange2.startDate <= dateRange1.endDate
  )
    return true; // dateRange2 starts in dateRange1
  if (
    dateRange1.startDate <= dateRange2.endDate &&
    dateRange2.endDate <= dateRange1.endDate
  )
    return true; // dateRange2 ends in dateRange1
  if (
    dateRange2.startDate < dateRange1.startDate &&
    dateRange1.endDate < dateRange2.endDate
  )
    return true; // dateRange2 includes dateRange1
  return false;
};

/**
 * @name checkAvailabibility
 * @function
 * @memberof module:lib/leaseLibrary
 * @desc Check if a specific dateRange overlaps with at least one other in a dateRange array.
 * @param {[{startDate: Date, endDate: Date}]}  dateRangeArray - array of dateRanges
 * @param {{startDate: Date, endDate: Date}} dateRange
 * @returns {Number} - returns the index of matching dateRange or else -1 if no match is found.
 */

const checkAvailabibility = (dateRangeArray, dateRange) => {
  for (let dr of dateRangeArray) {
    if (dateRangeOverlaps(dr, dateRange)) {
      return dateRangeArray.indexOf(dr);
    }
  }
  return -1;
};

/**
 * @name googleAuthVerify
 * @async
 * @function
 * @memberof module:lib/leaseLibrary
 * @desc Validate a google connect token and return extracted user info
 * @param {Object} google token contained in credentialResponse.credential
 * @returns {{isTokenValid: Boolean, firstname: String, lastname: String, username: String, email: String}}
 */

const googleAuthVerify = async (googleToken) => {
  const client = new OAuth2Client(process.env.CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken: googleToken,
    audience: process.env.CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
    // Or, if multiple clients access the backend:
    //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
  });
  const payload = ticket.getPayload();
  console.log(payload);

  const userid = payload["sub"];
  console.log(userid);

  // https://developers.google.com/identity/gsi/web/reference/js-reference?hl=fr#CredentialResponse
  /*
   * Les champs email, email_verified et hd vous permettent de déterminer si Google héberge une adresse e-mail et fait autorité pour celle-ci.
   * Dans les cas où Google fait autorité, l'utilisateur est connu pour être le titulaire légitime du compte.
   * Cas dans lesquels Google fait autorité:
   * 1. email comporte un suffixe @gmail.com : il s'agit d'un compte Gmail.
   * 2. email_verified est défini sur "true" et que hd est défini (il s'agit d'un compte G Suite).
   */
  // cas 1
  const isTokenValid = payload.email.split("@")[1] === "gmail.com";

  return {
    isTokenValid,
    firstname: payload.given_name,
    lastname: payload.family_name,
    username: payload.given_name + payload.family_name,
    email: payload.email,
  };
};

const verifyJWT = (req, res, next) => {
  // Get the token from the request headers
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Verify the token using the secret key
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Add the decoded user object to the request object for future use
    req.user = decoded;

    next();
  });
};

/**
 * @name compareDateRanges
 * @function
 * @memberof module:lib/leaseLibrary
 * @desc compares two dateRanges length and returns a value that indicates their relationship.
 * @param {{startDate: Date, endDate: Date}} dr1 - date range 1, used as reference
 * @param {{startDate: Date, endDate: Date}}  dr2 - date range 2
 * @returns {Number | null } -  < 0 : dr1 is less than dr2. > 0 : dr1 is greater than dr2. 0 : dr1 is equal to dr2
 */

const compareDateRanges = (dr1, dr2) => {
  if (!dr1.startDate || !dr1.endDate || !dr2.startDate || !dr2.endDate)
    return null;

  const a = {
    startDate: new Date(dr1.startDate).getTime(),
    endDate: new Date(dr1.endDate).getTime(),
  };
  const b = {
    startDate: new Date(dr2.startDate).getTime(),
    endDate: new Date(dr2.endDate).getTime(),
  };

  if (a.endDate - a.startDate < b.endDate - b.startDate) {
    return -1;
  } else if (a.endDate - a.startDate > b.endDate - b.startDate) {
    return 1;
  } else {
    return 0;
  }
};

/**
 * @name dateRangeSplitter
 * @function
 * @memberof module:lib/leaseLibrary
 * @desc used to deduct a reservation period from a broader availability period and split it in two remaining lesser parts.
 * @desc takes a dateRangeToSplit, extract from it the dateRangeToWithdraw and returns one or two lesser dateRanges in an array
 * @param {{startDate: Date, endDate: Date}} dateRangeToSplit - date range to split
 * @param {{startDate: Date, endDate: Date}}  dateRangeToWithdraw - date range to substract from dateRangeToSplit
 * @returns {[Object]} An array of one or two dateRanges objects. If empty, error. If it contains a single null value, the dateRange is fully reservated and is to be removed completely from DB.
 */

const dateRangeSplitter = (dateRangeToSplit, dateRangeToWithdraw) => {
  /*
   * SECURITY CHECKLIST BEFORE REACHING ALGO
   */

  if (
    !dateRangeToSplit.startDate ||
    !dateRangeToSplit.endDate ||
    !dateRangeToWithdraw.startDate ||
    !dateRangeToWithdraw.endDate
  )
    return [];

  console.log({ dateRangeToSplit }, { dateRangeToWithdraw });

  // double check if dateRanges overlap
  if (!dateRangeOverlaps(dateRangeToSplit, dateRangeToWithdraw)) return [];

  // checkif startDate is not superior to endDate. In that case, return empty array
  if (
    new Date(dateRangeToWithdraw.startDate).getTime() >
    new Date(dateRangeToWithdraw.endDate).getTime()
  )
    return [];

  // check if malformed parameters. In that case, return empty array
  if (
    isNaN(new Date(dateRangeToWithdraw.startDate).getTime()) ||
    isNaN(new Date(dateRangeToWithdraw.endDate).getTime()) ||
    isNaN(new Date(dateRangeToSplit.startDate).getTime()) ||
    isNaN(new Date(dateRangeToSplit.endDate).getTime())
  )
    return [];

  /*
   * SECURITY CHECKLIST : TOUS LES TESTS SONT VALIDES !
   */

  /*
   * ALGO
   * Seven overlaps cases
   * Two exclusives branches
   * branch 1 : one or two boundaries of dateRangeToWithdraw is outside of dateRangeToSplit
   * branch 2 : boundaries of dateRangeToWithdraw are inside of dateRangeToSplit
   */

  const DAY_IN_MS = 1000 * 60 * 60 * 24;

  if (
    new Date(dateRangeToWithdraw.startDate).getTime() <
      new Date(dateRangeToSplit.startDate).getTime() ||
    new Date(dateRangeToWithdraw.endDate).getTime() >
      new Date(dateRangeToSplit.endDate).getTime() + DAY_IN_MS
  ) {
    console.log("branch 1");

    // handle case where dateRangeToWithdraw starts before and ends within dateRangeToSplit
    if (
      new Date(dateRangeToWithdraw.startDate).getTime() <
        new Date(dateRangeToSplit.startDate).getTime() &&
      new Date(dateRangeToWithdraw.endDate).getTime() <=
        new Date(dateRangeToSplit.endDate).getTime()
    ) {
      console.log(
        "branch out-of-boundary cas 1: dateRangeToWithdraw starts before and ends within dateRangeToSplit => [{dr1}]"
      );

      return [
        {
          startDate: new Date(
            new Date(dateRangeToWithdraw.endDate).getTime() + DAY_IN_MS
          ),
          endDate: new Date(new Date(dateRangeToSplit.endDate).getTime()),
        },
      ];
    }

    // handle case where dateRangeToWithdraw starts within dateRangeToSplit and ends after it
    else if (
      new Date(dateRangeToWithdraw.startDate).getTime() >=
        new Date(dateRangeToSplit.startDate).getTime() &&
      new Date(dateRangeToWithdraw.startDate).getTime() <=
        new Date(dateRangeToSplit.endDate).getTime() &&
      new Date(dateRangeToWithdraw.endDate).getTime() >
        new Date(dateRangeToSplit.endDate).getTime()
    ) {
      console.log(
        "branch out-of-boundary cas 2: dateRangeToWithdraw starts within dateRangeToSplit and ends after it => [{dr1}]"
      );

      return [
        {
          startDate: new Date(new Date(dateRangeToSplit.startDate).getTime()),
          endDate: new Date(
            new Date(dateRangeToWithdraw.startDate).getTime() - DAY_IN_MS
          ),
        },
      ];
    }

    // handle case where dateRangeToWithdraw starts before and ends after dateRangeToSplit
    else if (
      new Date(dateRangeToWithdraw.startDate).getTime() <
        new Date(dateRangeToSplit.startDate).getTime() &&
      new Date(dateRangeToWithdraw.endDate).getTime() >
        new Date(dateRangeToSplit.endDate).getTime()
    ) {
      console.log(
        "branch out-of-boundary cas 3: dateRangeToWithdraw starts before and ends after dateRangeToSplit => [{dr1}]"
      );

      return [
        {
          startDate: new Date(dateRangeToSplit.startDate),
          endDate: new Date(dateRangeToSplit.endDate),
        },
      ];
    }
  }

  // branch 2 : boundaries of dateRangeToWithdraw are inside of dateRangeToSplit
  else {
    console.log(
      "branch 2 : boundaries of dateRangeToWithdraw are inside of dateRangeToSplit"
    );
    if (
      new Date(dateRangeToWithdraw.startDate).getTime() ==
        new Date(dateRangeToSplit.startDate).getTime() &&
      new Date(dateRangeToWithdraw.endDate).getTime() ==
        new Date(dateRangeToSplit.endDate).getTime()
    ) {
      // cas 1: dateRangeToWithdraw commence en même temps que dateRangeToSplit => [{dr1}]
      console.log(
        "branch within-boundaries cas 1: dateRangeToWithdraw commence en même temps que dateRangeToSplit => [{dr1}]"
      );

      return [null]; // it means to caller function : delete this entry !
    }

    if (
      new Date(dateRangeToWithdraw.startDate).getTime() ==
      new Date(dateRangeToSplit.startDate).getTime()
    ) {
      // cas 2: dateRangeToWithdraw commence en même temps que dateRangeToSplit => [{dr1}]
      console.log(
        "branch within-boundaries cas 2: dateRangeToWithdraw commence en même temps que dateRangeToSplit => [{dr1}]"
      );

      return [
        {
          startDate: new Date(
            new Date(dateRangeToWithdraw.endDate).getTime() + DAY_IN_MS
          ),
          endDate: new Date(new Date(dateRangeToSplit.endDate).getTime()),
        },
      ];
    }
    // cas 3: dateRangeToWithdraw termine en même temps que dateRangeToSplit => [{dr1}]
    else if (
      new Date(dateRangeToWithdraw.endDate).getTime() ==
      new Date(dateRangeToSplit.endDate).getTime()
    ) {
      console.log(
        "branch within-boundaries cas 3: dateRangeToWithdraw termine en même temps que dateRangeToSplit => [{dr1}]"
      );

      return [
        {
          startDate: new Date(new Date(dateRangeToSplit.startDate).getTime()),
          endDate: new Date(
            new Date(dateRangeToWithdraw.startDate).getTime() - DAY_IN_MS
          ),
        },
      ];
    }
    // cas 4 : dateRangeToWithdraw is in the middle of dateRangeToSplit => [{dr1},{dr2}]
    else {
      console.log(
        "branch within-boundaries cas 4 : dateRangeToWithdraw is in the middle of dateRangeToSplit => [{dr1},{dr2}]"
      );

      let newStartRange1 = {
        startDate: new Date(dateRangeToSplit.startDate),
        endDate: new Date(
          new Date(dateRangeToWithdraw.startDate).getTime() - DAY_IN_MS
        ),
      };
      let newStartRange2 = {
        startDate: new Date(
          new Date(dateRangeToWithdraw.endDate).getTime() + DAY_IN_MS
        ),
        endDate: new Date(dateRangeToSplit.endDate),
      };

      return [newStartRange1, newStartRange2];
    }
  }
};

module.exports = {
  haversineDistance,
  dateRangeOverlaps,
  checkAvailabibility,
  googleAuthVerify,
  verifyJWT,
  dateRangeSplitter,
  compareDateRanges,
};
