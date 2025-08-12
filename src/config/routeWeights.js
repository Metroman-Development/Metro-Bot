module.exports = {

    FASTEST: {

        stations: 0.3, // Higher weight for fewer stations

        transfers: 0.7 // Lower weight for transfers

    },

    BALANCED: {

        stations: 0.5, // Equal weight for stations and transfers

        transfers: 0.5

    },

    SCENIC: {

        stations: 0.7, // Lower weight for stations

        transfers: 0.3 // Higher weight for fewer transfers

    }

};
