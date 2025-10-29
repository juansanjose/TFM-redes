export const tutorials = {
  bgp01: {
    title: "BGP Peering Lab Walkthrough",
    intro: [
      "Spin up three FRR routers (r1, r2, r3) running BGP in a simple line topology.",
      "Use the tasks below to verify reachability, session state, and route propagation."
    ],
    tasks: [
      {
        id: "check-frr",
        title: "Verify FRR service",
        command: "sudo systemctl status frr --no-pager",
        prompt: [
          "Confirm that the FRR service is active before you begin the lab steps.",
          "If you are using the official container image, the init script already enables zebra/bgpd for you."
        ],
        solution: [
          { text: "If FRR is not running, start it manually:" },
          { code: "sudo systemctl restart frr || sudo /usr/lib/frr/frrinit.sh start" },
          {
            text: "Still failing? Inspect `/etc/frr/daemons` to ensure the required daemons are set to `yes`."
          }
        ]
      },
      {
        id: "verify-interfaces",
        title: "Check interface status",
        command: "ip addr",
        prompt: [
          "Verify that the lab-facing interfaces (such as `eth1`) are up on every router.",
          "Use `ip addr` as a quick way to confirm link state before troubleshooting BGP."
        ],
        solution: [
          { text: "Example command that filters to a specific interface:" },
          { code: "ip addr show dev eth1" }
        ]
      },
      {
        id: "bgp-summary",
        title: "Inspect BGP neighbors",
        command: "vtysh -c 'show ip bgp summary'",
        prompt: [
          "Check that each peer relationship is in the `Established` state.",
          "This confirms TCP connectivity and that hold timers are being exchanged."
        ],
        solution: [
          { text: "Sample output with r1 peering to r2:" },
          {
            code: [
              "Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ  Up/Down State/PfxRcd",
              "10.0.12.2       4 65002     123     120        0    0    0 00:05:31            1"
            ].join("\n")
          }
        ]
      },
      {
        id: "route-propagation",
        title: "Confirm route propagation",
        command: "vtysh -c 'show ip bgp'",
        prompt: [
          "Make sure each router has learned the /32 loopbacks advertised by its neighbors.",
          "Look for best-path entries that point at the adjacent router."
        ],
        solution: [
          { text: "Expected line on r2 showing r1's loopback:" },
          { code: ">*> 10.0.1.1/32    10.0.12.1              0             0 65001 i" }
        ]
      },
      {
        id: "traceroute",
        title: "Traceroute across the lab",
        command: "traceroute 10.0.3.3",
        prompt: [
          "Validate end-to-end reachability by tracing from r1 to r3.",
          "The path should traverse r2 once routing is converged."
        ],
        solution: [
          { text: "Install traceroute if it is missing inside the container:" },
          { code: "sudo apk add traceroute   # Alpine-based nodes\n# or: sudo apt-get install traceroute" },
          { text: "A healthy trace from r1 will show r2 as the intermediate hop before reaching r3." }
        ]
      }
    ]
  }
};
