import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { applyTheme, app, type Theme } from './lib/app.svelte';

applyTheme((localStorage.getItem('ll.theme') ?? 'system') as Theme);
mount(App, { target: document.getElementById('app')! });
app.init();
