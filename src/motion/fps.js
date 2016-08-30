let container = document.createElement('p');
let text = document.createTextNode('0 FPS');

container.appendChild(text);
container.style.position = 'absolute';
container.style.top = '0';
container.style.right = '20px';
container.style.fontFamily = 'sans-serif';
container.style.fontSize = '20px';

exports = module.exports = node => {
    node.appendChild(container);
    return container;
};
