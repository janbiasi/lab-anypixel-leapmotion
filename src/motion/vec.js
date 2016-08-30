exports.vec2f = list => {
    if(Array.isArray(list)) {
        return {
            x: list[0],
            y: list[1],
            z: list[2]
        }
    }
};

exports.vec2i = list => {
    if(Array.isArray(list)) {

    } else {
        return {
            x: parseInt(list.x),
            y: parseInt(list.y) || null,
            z: parseInt(list.z)
        };
    }
}
