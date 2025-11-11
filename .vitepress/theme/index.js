import DefaultTheme from 'vitepress/theme'
import 'viewerjs/dist/viewer.min.css';
import imageViewer from 'vitepress-plugin-image-viewer';
import vImageViewer from 'vitepress-plugin-image-viewer/lib/vImageViewer.vue';
import { useRoute } from 'vitepress';

export default {
    ...DefaultTheme,
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx);
        // Register global components, if you don't want to use it, you don't need to add it
        ctx.app.component('vImageViewer', vImageViewer);
        // ...
    },
    setup() {
        // Get route
        const route = useRoute();
        // Using
        imageViewer(route);
    }
};