import httpx,pytest
from scripts.monitor import probe

@pytest.mark.parametrize('status,body,healthy',[(200,{'ready':True,'checks':['database']},True),(503,{'ready':False,'checks':['database']},False),(200,{},False),(302,{},False),(200,'garbage',False)])
def test_probe_requires_actual_readiness(status,body,healthy):
    with httpx.Client(transport=httpx.MockTransport(lambda request:httpx.Response(status,json=body))) as client:
        assert probe('http://127.0.0.1:8000',client)['healthy'] is healthy

def test_connection_failure_is_non_sensitive():
    def broken(request):raise httpx.ConnectError('PRIVATE URL AND TOKEN')
    with httpx.Client(transport=httpx.MockTransport(broken)) as client:
        result=probe('http://127.0.0.1:8000',client)
        assert result['healthy'] is False and 'PRIVATE' not in str(result)
    with pytest.raises(ValueError):probe('https://user:password@example.test')
