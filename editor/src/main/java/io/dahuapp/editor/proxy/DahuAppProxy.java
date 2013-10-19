package io.dahuapp.editor.proxy;

import io.dahuapp.editor.app.DahuApp;
import javafx.application.Platform;
import javafx.scene.web.WebEngine;
import javafx.stage.Stage;

/**
 * Manager of all the drivers. Offers an interface between the javascript and
 * the java with access to some methods of the drivers.
 */
public class DahuAppProxy implements Proxy {
    public void onStop(){};
    public void onLoad(){};
    public LoggerProxy logger = new LoggerProxy("/tmp/");
}
