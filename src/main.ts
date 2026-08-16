import './style.css';
import * as Controller from './controller';
import * as Model from './model';
import * as View from './view';

const model = new Model.Game();
const view = new View.Game('#game');
new Controller.Game(model, view).start();
