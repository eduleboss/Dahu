package io.dahuapp.editor.proxy;

import io.dahuapp.editor.drivers.ScreenDriver;

/**
 * Proxy for the screen driver.
 */
public class ScreenDriverProxy implements Proxy {
    
    /**
     * Driver associated with this proxy.
     */
    private ScreenDriver driver = new ScreenDriver();
    
    /**
     * Takes a screenshot in the project directory.
     * @param projectDir The project directory.
     */
    public String takeScreen(String projectDir, String id) {
        return driver.takeScreen(projectDir, id);
    }
    
    @Override
    public void onLoad() {
        driver.onLoad();
    }

    @Override
    public void onStop() {
        driver.onStop();
    }
}
