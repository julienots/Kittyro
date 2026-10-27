package com.mossymeadows.game;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Local multiplayer without any server (window.KittyNet): one phone hosts a tiny
 * TCP relay on the Wi-Fi network and announces itself by UDP broadcast; the
 * others find it and connect. Messages are single lines of JSON, relayed by the
 * game's JavaScript. Nothing ever leaves the local network.
 */
class LanBridge {
    static final int TCP_PORT = 47321;
    static final int UDP_PORT = 47322;
    private static final String BEACON = "KITTYRO1|";
    private static final int MAX_LINE = 16 * 1024;
    private static final Charset UTF8 = Charset.forName("UTF-8");

    private final MainActivity activity;
    private final ExecutorService sendPool = Executors.newSingleThreadExecutor();
    private final Map<Integer, Socket> peers = new ConcurrentHashMap<>();
    private volatile ServerSocket server;
    private volatile Socket hostLink;
    private volatile DatagramSocket beaconSock;
    private volatile DatagramSocket scanSock;
    private volatile boolean running;
    private volatile String hostName = "";
    private WifiManager.MulticastLock lock;
    private int nextId = 1;

    LanBridge(MainActivity activity) {
        this.activity = activity;
    }

    private void emit(JSONObject ev) {
        activity.netEvent(ev.toString());
    }

    private void emit(String type, Object... kv) {
        try {
            JSONObject o = new JSONObject();
            o.put("e", type);
            for (int i = 0; i + 1 < kv.length; i += 2) o.put((String) kv[i], kv[i + 1]);
            emit(o);
        } catch (Exception ignored) {
        }
    }

    private void acquireLock() {
        try {
            if (lock == null) {
                WifiManager wm = (WifiManager) activity.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm == null) return;
                lock = wm.createMulticastLock("kittyro-lan");
                lock.setReferenceCounted(false);
            }
            lock.acquire();
        } catch (Exception ignored) {
        }
    }

    private void releaseLock() {
        try {
            if (lock != null && lock.isHeld()) lock.release();
        } catch (Exception ignored) {
        }
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return true;
    }

    /** IPv4 address of this phone on the Wi-Fi network ("" if none). */
    @JavascriptInterface
    public String localIp() {
        for (InterfaceAddress a : ipv4Interfaces()) return a.getAddress().getHostAddress();
        return "";
    }

    private List<InterfaceAddress> ipv4Interfaces() {
        List<InterfaceAddress> out = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> it = NetworkInterface.getNetworkInterfaces();
            if (it == null) return out;
            for (NetworkInterface ni : Collections.list(it)) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress a : ni.getInterfaceAddresses()) {
                    if (a.getAddress() instanceof Inet4Address) out.add(a);
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    // ------------------------------------------------------------------ host

    @JavascriptInterface
    public boolean host(String name) {
        stop();
        hostName = name == null ? "" : name.replace('|', ' ');
        if (hostName.length() > 40) hostName = hostName.substring(0, 40);
        try {
            ServerSocket ss = new ServerSocket();
            ss.setReuseAddress(true);
            ss.bind(new InetSocketAddress(TCP_PORT));
            server = ss;
        } catch (Exception e) {
            emit("error", "msg", "port");
            return false;
        }
        running = true;
        acquireLock();
        new Thread(new Runnable() {
            @Override
            public void run() {
                acceptLoop();
            }
        }, "lan-accept").start();
        new Thread(new Runnable() {
            @Override
            public void run() {
                beaconLoop();
            }
        }, "lan-beacon").start();
        emit("hosting", "ip", localIp());
        return true;
    }

    private void acceptLoop() {
        while (running && server != null) {
            try {
                final Socket s = server.accept();
                s.setTcpNoDelay(true);
                final int id;
                synchronized (this) {
                    id = nextId++;
                }
                if (peers.size() >= 7) {
                    s.close();
                    continue;
                }
                peers.put(id, s);
                emit("peer", "id", id);
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        readLoop(s, id);
                    }
                }, "lan-peer-" + id).start();
            } catch (Exception e) {
                if (!running) return;
            }
        }
    }

    private void beaconLoop() {
        try {
            DatagramSocket ds = new DatagramSocket();
            ds.setBroadcast(true);
            beaconSock = ds;
            byte[] msg = (BEACON + hostName + "|" + TCP_PORT).getBytes(UTF8);
            while (running && server != null) {
                List<InetAddress> targets = new ArrayList<>();
                for (InterfaceAddress a : ipv4Interfaces()) if (a.getBroadcast() != null) targets.add(a.getBroadcast());
                targets.add(InetAddress.getByName("255.255.255.255"));
                for (InetAddress t : targets) {
                    try {
                        ds.send(new DatagramPacket(msg, msg.length, t, UDP_PORT));
                    } catch (Exception ignored) {
                    }
                }
                Thread.sleep(1000);
            }
        } catch (Exception ignored) {
        } finally {
            if (beaconSock != null) beaconSock.close();
            beaconSock = null;
        }
    }

    // ------------------------------------------------------------------ join

    /** Listen for hosts announcing themselves on the Wi-Fi. */
    @JavascriptInterface
    public void scan(boolean on) {
        if (!on) {
            DatagramSocket s = scanSock;
            scanSock = null;
            if (s != null) s.close();
            if (server == null) releaseLock();
            return;
        }
        if (scanSock != null) return;
        acquireLock();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    DatagramSocket ds = new DatagramSocket(null);
                    ds.setReuseAddress(true);
                    ds.setBroadcast(true);
                    ds.bind(new InetSocketAddress(UDP_PORT));
                    scanSock = ds;
                    byte[] buf = new byte[512];
                    String mine = localIp();
                    while (scanSock == ds) {
                        DatagramPacket p = new DatagramPacket(buf, buf.length);
                        ds.receive(p);
                        String txt = new String(p.getData(), 0, p.getLength(), UTF8);
                        if (!txt.startsWith(BEACON)) continue;
                        String ip = p.getAddress().getHostAddress();
                        if (ip.equals(mine) && server != null) continue;
                        String[] parts = txt.split("\\|");
                        emit("found", "ip", ip, "name", parts.length > 1 ? parts[1] : "");
                    }
                } catch (Exception ignored) {
                }
            }
        }, "lan-scan").start();
    }

    @JavascriptInterface
    public void join(final String ip) {
        if (ip == null || !ip.matches("[0-9.]{7,15}")) {
            emit("error", "msg", "ip");
            return;
        }
        stop();
        running = true;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Socket s = new Socket();
                    s.connect(new InetSocketAddress(ip, TCP_PORT), 5000);
                    s.setTcpNoDelay(true);
                    hostLink = s;
                    emit("connected", "ip", ip);
                    readLoop(s, 0);
                } catch (Exception e) {
                    emit("error", "msg", "connect");
                    running = false;
                }
            }
        }, "lan-join").start();
    }

    // ------------------------------------------------------------------ traffic

    private void readLoop(Socket s, int id) {
        try {
            BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), UTF8));
            String line;
            while (running && (line = in.readLine()) != null) {
                if (line.length() > MAX_LINE) continue;
                emit("msg", "id", id, "d", line);
            }
        } catch (Exception ignored) {
        }
        try {
            s.close();
        } catch (Exception ignored) {
        }
        if (id == 0) {
            if (hostLink == s) {
                hostLink = null;
                emit("closed");
            }
        } else if (peers.remove(id) != null) {
            emit("gone", "id", id);
        }
    }

    private void write(Socket s, byte[] data) {
        try {
            OutputStream out = s.getOutputStream();
            out.write(data);
            out.flush();
        } catch (Exception e) {
            try {
                s.close();
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * Send one line. Host: to = peer id, -1 = every peer, or -(id+2) = every peer but id.
     * Client: always to the host.
     */
    @JavascriptInterface
    public void send(final int to, String line) {
        if (line == null || line.length() > MAX_LINE) return;
        final byte[] data = (line.replace('\n', ' ') + "\n").getBytes(UTF8);
        sendPool.execute(new Runnable() {
            @Override
            public void run() {
                Socket h = hostLink;
                if (h != null) {
                    write(h, data);
                    return;
                }
                if (to >= 0) {
                    Socket s = peers.get(to);
                    if (s != null) write(s, data);
                    return;
                }
                int skip = to == -1 ? -1 : -(to + 2);
                for (Map.Entry<Integer, Socket> e : peers.entrySet()) {
                    if (e.getKey() != skip) write(e.getValue(), data);
                }
            }
        });
    }

    @JavascriptInterface
    public void stop() {
        running = false;
        ServerSocket ss = server;
        server = null;
        if (ss != null) {
            try {
                ss.close();
            } catch (Exception ignored) {
            }
        }
        DatagramSocket b = beaconSock;
        if (b != null) b.close();
        Socket h = hostLink;
        hostLink = null;
        if (h != null) {
            try {
                h.close();
            } catch (Exception ignored) {
            }
        }
        for (Socket s : peers.values()) {
            try {
                s.close();
            } catch (Exception ignored) {
            }
        }
        peers.clear();
        if (scanSock == null) releaseLock();
    }
}
