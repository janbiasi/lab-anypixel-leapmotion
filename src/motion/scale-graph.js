let scaleToPositive = (box, x, z) => {
    let result = {};

    result.x = box.size[0] + x;
    result.z = box.size[2] + z;

    result.x = result.x < 0 ? 0 : result.x;
    result.z = result.z < 0 ? 0 : result.z;

    return result;
};

let scaleRelative = (point, max, target) => {
    return point / max * target;
};

exports = module.exports = (canvas, box, x, z) => {
    let pos = scaleToPositive(box, x, z);

    let rel = {
        x: scaleRelative(pos.x, box.size[0] * 2, canvas.width),
        z: scaleRelative(pos.z, box.size[2] * 2, canvas.height)
    }

    return rel;
};
